"""
Video watermarking — vectorized DCT frame watermarking + QIM payload layer.

Two independent layers
----------------------
Layer 1 – Statistical (DCT):
  Apply DCT watermark to Y-channel of every SAMPLE_EVERY-th frame.
  Detection: average Pearson correlation across sampled frames.

Layer 2 – Payload (QIM):
  Embed all 240 payload bits in PAYLOAD_FRAMES key frames using
  Quantization Index Modulation (step QIM_STEP = 8) in mid-frequency
  DCT coefficients.  Majority-vote across copies at extraction.

Performance improvements over v1
---------------------------------
1. Vectorized block DCT — reshape frame to (nb_h, nb_w, 8, 8) and call
   scipy.fft.dctn(axes=(-2,-1)) once per frame instead of one call per
   8×8 block.  For 1080p: 32,400 Python iterations → 1 scipy call.
2. Vectorized QIM — numpy fancy indexing replaces the 240-iteration loop.
3. Cached masks and QIM positions — SHA256/PRNG computed once per
   unique (key, H, W), reused across all frames.
4. Streaming embed — frames are read, processed, and written one at a
   time; no frame list held in RAM.
5. Selective verify — only sampled frames (every SAMPLE_EVERY-th) and
   PAYLOAD_FRAMES key frames are decoded; the rest are skipped via seek.
"""

import base64
import hashlib
import os
import tempfile
from typing import Tuple, Dict, Optional, List

import numpy as np

try:
    import cv2
    _CV2 = True
except ImportError:
    _CV2 = False

try:
    from scipy.fft import dctn, idctn
    _SCIPY = True
except ImportError:
    _SCIPY = False

from watermarking.payload import (
    PAYLOAD_BITS,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
)

SAMPLE_EVERY   = 10    # statistical DCT watermark on every Nth frame
PAYLOAD_FRAMES = 5     # key frames carrying a full QIM payload copy
QIM_STEP       = 32.0  # QIM quantization step (32 survives ±2 px YCrCb rounding)

# Module-level caches — computed once per unique (key, H, W)
_mask_cache: dict = {}
_qim_cache:  dict = {}


# ── Vectorized block helpers ──────────────────────────────────────────────────

def _to_blocks(Y: np.ndarray) -> np.ndarray:
    """(H, W) float64 → (nb_h, nb_w, 8, 8) block grid (trimmed to 8-multiples)."""
    H, W   = Y.shape
    nb_h, nb_w = H // 8, W // 8
    return (Y[:nb_h*8, :nb_w*8]
              .reshape(nb_h, 8, nb_w, 8)
              .transpose(0, 2, 1, 3)
              .copy())


def _from_blocks(blocks: np.ndarray, H: int, W: int) -> np.ndarray:
    """(nb_h, nb_w, 8, 8) → (H, W) float64 (original border pixels preserved)."""
    nb_h, nb_w = blocks.shape[:2]
    trimmed = blocks.transpose(0, 2, 1, 3).reshape(nb_h * 8, nb_w * 8)
    out = np.zeros((H, W), dtype=np.float64)
    out[:nb_h*8, :nb_w*8] = trimmed
    return out


def _dct_blocks(Y: np.ndarray) -> np.ndarray:
    """2D DCT on all 8×8 blocks in one scipy call → (nb_h, nb_w, 8, 8)."""
    blocks = _to_blocks(Y)
    if _SCIPY:
        return dctn(blocks, norm="ortho", axes=(-2, -1))
    # Fallback: block-by-block (slow; only if scipy missing)
    out = blocks.copy()
    from watermarking.image_watermark import _dct2
    for i in range(blocks.shape[0]):
        for j in range(blocks.shape[1]):
            out[i, j] = _dct2(blocks[i, j])
    return out


def _idct_blocks(C: np.ndarray) -> np.ndarray:
    """2D IDCT on all 8×8 blocks in one scipy call → (nb_h, nb_w, 8, 8)."""
    if _SCIPY:
        return idctn(C, norm="ortho", axes=(-2, -1))
    out = C.copy()
    from watermarking.image_watermark import _idct2
    for i in range(C.shape[0]):
        for j in range(C.shape[1]):
            out[i, j] = _idct2(C[i, j])
    return out


# ── Cached key material ───────────────────────────────────────────────────────

def _dct_mask_blocks(key: bytes, H: int, W: int) -> np.ndarray:
    """Key-derived ±1 mask reshaped to (nb_h, nb_w, 8, 8) — cached."""
    k = (key, H, W)
    if k not in _mask_cache:
        seed = int(hashlib.sha256(key + b"video_dct").hexdigest()[:8], 16) % (2**31)
        mask = np.random.RandomState(seed).choice([-1.0, 1.0], size=(H, W)).astype(np.float64)
        _mask_cache[k] = _to_blocks(mask)
    return _mask_cache[k]


def _qim_positions(key: bytes, H: int, W: int):
    """Key-derived QIM positions as numpy arrays (brs, bcs, us, vs) — cached.

    Positions are guaranteed to be unique (no two payload bits share the same
    DCT coefficient), which prevents embedding collisions.
    """
    k = (key, H, W)
    if k not in _qim_cache:
        seed = int(hashlib.sha256(key + b"video_qim").hexdigest()[:8], 16) % (2**31)
        rng  = np.random.RandomState(seed)
        nb_h = max(1, H // 8)
        nb_w = max(1, W // 8)

        seen = set()
        brs_l, bcs_l, us_l, vs_l = [], [], [], []
        # Generate candidates until we have PAYLOAD_BITS unique positions
        while len(brs_l) < PAYLOAD_BITS:
            br = int(rng.randint(0, nb_h))
            bc = int(rng.randint(0, nb_w))
            u  = int(rng.randint(1, 5))
            v  = int(rng.randint(1, 5))
            pos = (br, bc, u, v)
            if pos not in seen:
                seen.add(pos)
                brs_l.append(br); bcs_l.append(bc)
                us_l.append(u);   vs_l.append(v)

        _qim_cache[k] = (
            np.array(brs_l), np.array(bcs_l),
            np.array(us_l),  np.array(vs_l),
        )
    return _qim_cache[k]


# ── Core operations (all vectorized) ─────────────────────────────────────────

def _apply_dct_stat(Y: np.ndarray, key: bytes, alpha: float) -> np.ndarray:
    """DCT statistical watermark — one scipy call per frame."""
    H, W  = Y.shape
    mask  = _dct_mask_blocks(key, H, W)   # (nb_h, nb_w, 8, 8)
    C     = _dct_blocks(Y)
    C[:, :, 1:5, 1:5] += alpha * mask[:, :, 1:5, 1:5]
    Y_w   = Y.copy()
    nb_h, nb_w = C.shape[:2]
    Y_w[:nb_h*8, :nb_w*8] = np.clip(_from_blocks(_idct_blocks(C), H, W)[:nb_h*8, :nb_w*8], 0, 255)
    return Y_w


def _dct_correlation(Y: np.ndarray, key: bytes) -> float:
    """DCT Pearson correlation — vectorized flatten."""
    H, W  = Y.shape
    mask  = _dct_mask_blocks(key, H, W)
    C     = _dct_blocks(Y)
    C_mf  = C[:, :, 1:5, 1:5].flatten()
    W_mf  = mask[:, :, 1:5, 1:5].flatten()
    if np.std(C_mf) < 1e-9 or np.std(W_mf) < 1e-9:
        return 0.0
    return float(np.corrcoef(C_mf, W_mf)[0, 1])


def _embed_qim(Y: np.ndarray, bits: list, key: bytes) -> np.ndarray:
    """QIM embedding — numpy fancy indexing, no Python loop over bits."""
    H, W      = Y.shape
    brs, bcs, us, vs = _qim_positions(key, H, W)
    bits_arr  = np.array(bits[:PAYLOAD_BITS], dtype=np.int64)
    C         = _dct_blocks(Y)
    coefs     = C[brs, bcs, us, vs]
    q         = np.round(coefs / QIM_STEP).astype(np.int64)
    mismatch  = (q % 2) != bits_arr
    q[mismatch & (bits_arr == 1)] += 1
    q[mismatch & (bits_arr == 0)] -= 1
    C[brs, bcs, us, vs] = q.astype(np.float64) * QIM_STEP
    Y_w = Y.copy()
    nb_h, nb_w = C.shape[:2]
    Y_w[:nb_h*8, :nb_w*8] = np.clip(_from_blocks(_idct_blocks(C), H, W)[:nb_h*8, :nb_w*8], 0, 255)
    return Y_w


def _extract_qim(Y: np.ndarray, key: bytes) -> list:
    """QIM extraction — numpy fancy indexing, no Python loop over bits."""
    brs, bcs, us, vs = _qim_positions(key, *Y.shape)
    C    = _dct_blocks(Y)
    coefs = C[brs, bcs, us, vs]
    return (np.abs(np.round(coefs / QIM_STEP)).astype(np.int64) % 2).tolist()


def _key_frame_indices(n_frames: int) -> List[int]:
    return [int(i * max(1, n_frames / PAYLOAD_FRAMES)) % n_frames
            for i in range(PAYLOAD_FRAMES)]


def _process_frame(frame, idx: int, kf_set: set,
                   payload_bits: list, key: bytes, alpha: float):
    """Apply statistical and/or QIM watermark to one BGR frame.

    Statistical layer (DCT) uses the Y channel of YCrCb — good for perceptual
    imperceptibility but suffers ±1 rounding in BGR↔YCrCb double-conversion.

    QIM payload layer uses the GREEN channel of BGR directly — HFYU preserves
    BGR pixels exactly so there is zero round-trip error, guaranteeing reliable
    payload extraction.
    """
    result = frame.copy()

    # Layer 1: DCT statistical watermark on Y (YCrCb)
    if idx % SAMPLE_EVERY == 0:
        ycrcb = cv2.cvtColor(result, cv2.COLOR_BGR2YCrCb)
        Y     = ycrcb[:, :, 0].astype(np.float64)
        ycrcb[:, :, 0] = np.clip(_apply_dct_stat(Y, key, alpha), 0, 255).astype(np.uint8)
        result = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)

    # Layer 2: QIM payload on green channel (preserved exactly by HFYU)
    if idx in kf_set:
        G = result[:, :, 1].astype(np.float64)
        result[:, :, 1] = np.clip(_embed_qim(G, payload_bits, key), 0, 255).astype(np.uint8)

    return result


# ── Public API ────────────────────────────────────────────────────────────────

def embed_video_watermark(
    video_b64:  str,
    key:        bytes,
    alpha:      float = 4.0,
    model_name: Optional[str] = None,
    timestamp:  str = "",
) -> Tuple[str, Dict]:
    """
    Embed watermark into video (DCT statistical + QIM DCT payload).

    Streaming pipeline: reads, processes, and writes one frame at a time —
    peak RAM = ~3 uncompressed frames regardless of video length.

    Returns (base64_video, metadata_dict)
    """
    if not _CV2:
        raise RuntimeError("pip install opencv-python")

    raw  = base64.b64decode(video_b64)
    tin  = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    tout = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    tin.write(raw); tin.flush(); tin.close()
    tout.close()

    try:
        cap    = cv2.VideoCapture(tin.name)
        fps    = cap.get(cv2.CAP_PROP_FPS) or 25.0
        fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
        w      = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # If codec doesn't report frame count, do a fast pre-scan
        if total <= 0:
            total = 0
            while cap.grab():
                total += 1
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # rewind

        payload_bits = to_bits(build_payload(model_name, timestamp, key))
        kf_set       = set(_key_frame_indices(total)) if total > 0 else set()
        # Always write lossless (HFYU) so QIM payload survives pixel round-trip.
        # Lossy codecs (MJPG, XVID, mp4v) re-quantize DCT coefficients and
        # destroy the 8-step QIM signal.
        lossless = cv2.VideoWriter_fourcc(*"HFYU")
        vw       = cv2.VideoWriter(tout.name, lossless, fps, (w, h))

        stat_count = 0
        idx        = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % SAMPLE_EVERY == 0:
                stat_count += 1
            vw.write(_process_frame(frame, idx, kf_set, payload_bits, key, alpha))
            idx += 1

        cap.release()
        vw.release()

        with open(tout.name, "rb") as fp:
            out_b64 = base64.b64encode(fp.read()).decode("utf-8")

    finally:
        os.unlink(tin.name)
        try:
            os.unlink(tout.name)
        except OSError:
            pass

    return out_b64, {
        "embedding_method": "dct_qim_dual_layer",
        "alpha":            alpha,
        "total_frames":     idx,
        "stat_frames":      stat_count,
        "payload_frames":   len(kf_set),
        "payload_bits":     len(payload_bits),
        "resolution":       f"{w}×{h}",
        "fps":              fps,
    }


def verify_video_watermark(
    video_b64: str,
    key:       bytes,
    threshold: float = 0.04,
) -> Dict:
    """
    Stateless video watermark verification.

    Selective decode: only sampled frames (every SAMPLE_EVERY-th) and
    PAYLOAD_FRAMES key frames are actually decoded; the rest are skipped
    via cap.grab() which advances the position without full decode.

    Layer 1: average DCT correlation across sampled frames
    Layer 2: majority-vote QIM extraction from PAYLOAD_FRAMES key frames
    """
    if not _CV2:
        raise RuntimeError("pip install opencv-python")

    raw = base64.b64decode(video_b64)
    tmp = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    tmp.write(raw); tmp.flush(); tmp.close()

    base: Dict = {
        "detected":        False,
        "correlation":     0.0,
        "confidence":      0.0,
        "signature_valid": False,
        "model_name":      None,
        "timestamp_unix":  None,
        "wm_id":           None,
        "threshold":       threshold,
    }

    try:
        cap   = cv2.VideoCapture(tmp.name)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Fast pre-scan if total unknown
        if total <= 0:
            total = 0
            while cap.grab():
                total += 1
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        if total == 0:
            cap.release()
            return base

        kf_indices  = set(_key_frame_indices(total))
        need_decode = {i for i in range(0, total, SAMPLE_EVERY)} | kf_indices

        corr_vals: list = []
        qim_bits:  list = []

        idx = 0
        while idx < total:
            if idx in need_decode:
                ok, frame = cap.read()
                if not ok:
                    break
                ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
                Y     = ycrcb[:, :, 0].astype(np.float64)
                if idx % SAMPLE_EVERY == 0:
                    corr_vals.append(_dct_correlation(Y, key))
                if idx in kf_indices:
                    # Extract QIM from green channel (same channel used at embed time)
                    G = frame[:, :, 1].astype(np.float64)
                    qim_bits.append(_extract_qim(G, key))
            else:
                cap.grab()   # advance without full decode
            idx += 1

        cap.release()

    finally:
        os.unlink(tmp.name)

    if not corr_vals and not qim_bits:
        return base

    # Layer 1: DCT correlation
    rho = float(np.mean(corr_vals)) if corr_vals else 0.0

    # Layer 2: QIM majority vote
    sig_valid  = False
    model_name = None
    ts_unix    = None
    wm_id      = None

    if qim_bits:
        voted = [
            1 if sum(b[i] for b in qim_bits) > len(qim_bits) / 2 else 0
            for i in range(PAYLOAD_BITS)
        ]
        payload    = parse_payload(from_bits(voted), key)
        sig_valid  = payload is not None
        model_name = payload["model_name"]    if payload else None
        ts_unix    = payload["timestamp_unix"] if payload else None
        wm_id      = derive_wm_id(model_name, ts_unix, key) if payload else None

    stat_conf  = float(np.clip((rho - threshold) / max(1 - threshold, 0.01), 0, 1))
    confidence = round(float(max(stat_conf, 0.9 if sig_valid else 0.0)), 4)
    detected   = (rho > threshold) or sig_valid

    base.update({
        "detected":        detected,
        "correlation":     round(rho, 6),
        "confidence":      confidence,
        "signature_valid": sig_valid,
        "model_name":      model_name,
        "timestamp_unix":  ts_unix,
        "wm_id":           wm_id,
    })
    return base
