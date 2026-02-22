"""
Video watermarking — DCT frame statistical layer + QIM DCT payload layer.

Two independent layers
----------------------
Layer 1 – Statistical (DCT):
  Apply DCT watermark to Y-channel of every SAMPLE_EVERY-th frame.
  Detection: average Pearson correlation across sampled frames.

Layer 2 – Payload (QIM):
  Embed all 240 payload bits in PAYLOAD_FRAMES key frames using
  Quantization Index Modulation (step QIM_STEP = 8) in mid-frequency
  DCT coefficients.  Majority-vote across copies at extraction.
  QIM survives mild lossy compression (error < QIM_STEP/2 = 4 per coeff).

Codec note
----------
Lossless formats (AVI+DIB, AVI+HuffYUV, uncompressed AVI) preserve both
layers perfectly.  H.264 / XVID at high CRF may degrade the QIM layer;
the statistical DCT layer remains detectable.
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
    def _dct2(b: np.ndarray) -> np.ndarray: return dctn(b, norm="ortho")
    def _idct2(b: np.ndarray) -> np.ndarray: return idctn(b, norm="ortho")
except ImportError:
    from watermarking.image_watermark import _dct2, _idct2  # type: ignore

from watermarking.payload import (
    PAYLOAD_BITS,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
)

SAMPLE_EVERY   = 10   # DCT statistical watermark on every Nth frame
PAYLOAD_FRAMES = 5    # number of key frames carrying a full payload copy
QIM_STEP       = 8.0  # quantization step size for QIM


# ── Internal helpers ──────────────────────────────────────────────────────────

def _make_dct_mask(key: bytes, H: int, W: int) -> np.ndarray:
    seed = int(hashlib.sha256(key + b"video_dct").hexdigest()[:8], 16) % (2**31)
    return np.random.RandomState(seed).choice([-1.0, 1.0], size=(H, W)).astype(np.float64)


def _qim_positions(key: bytes, H: int, W: int) -> List[Tuple]:
    """Key-derived (block_row, block_col, u, v) for each of PAYLOAD_BITS coefficients."""
    seed = int(hashlib.sha256(key + b"video_qim").hexdigest()[:8], 16) % (2**31)
    rng  = np.random.RandomState(seed)
    nb_h = max(1, H // 8)
    nb_w = max(1, W // 8)
    return [
        (int(rng.randint(0, nb_h)), int(rng.randint(0, nb_w)),
         int(rng.randint(1, 5)),    int(rng.randint(1, 5)))
        for _ in range(PAYLOAD_BITS)
    ]


def _apply_dct_stat(Y: np.ndarray, key: bytes, alpha: float) -> np.ndarray:
    H, W = Y.shape
    mask = _make_dct_mask(key, H, W)
    Y_w  = Y.copy()
    for r in range(0, H - 7, 8):
        for c in range(0, W - 7, 8):
            blk = Y[r:r+8, c:c+8]
            if blk.shape != (8, 8):
                continue
            C = _dct2(blk)
            C[1:5, 1:5] += alpha * mask[r:r+8, c:c+8][1:5, 1:5]
            Y_w[r:r+8, c:c+8] = np.clip(_idct2(C), 0, 255)
    return Y_w


def _dct_correlation(Y: np.ndarray, key: bytes) -> float:
    H, W    = Y.shape
    mask    = _make_dct_mask(key, H, W)
    ext, mv = [], []
    for r in range(0, H - 7, 8):
        for c in range(0, W - 7, 8):
            blk = Y[r:r+8, c:c+8]
            if blk.shape != (8, 8):
                continue
            C = _dct2(blk)
            ext.extend(C[1:5, 1:5].flatten().tolist())
            mv.extend(mask[r:r+8, c:c+8][1:5, 1:5].flatten().tolist())
    if not ext:
        return 0.0
    C_v, W_v = np.array(ext), np.array(mv)
    if np.std(C_v) < 1e-9 or np.std(W_v) < 1e-9:
        return 0.0
    return float(np.corrcoef(C_v, W_v)[0, 1])


def _embed_qim(Y: np.ndarray, bits: list, key: bytes) -> np.ndarray:
    pos = _qim_positions(key, *Y.shape)
    Y_w = Y.copy()
    for i, (br, bc, u, v) in enumerate(pos):
        r, c = br * 8, bc * 8
        blk  = Y_w[r:r+8, c:c+8].copy()
        C    = _dct2(blk)
        bit  = bits[i]
        q    = round(C[u, v] / QIM_STEP)
        if q % 2 != bit:
            q += 1 if bit == 1 else -1
        C[u, v]             = q * QIM_STEP
        Y_w[r:r+8, c:c+8]  = np.clip(_idct2(C), 0, 255)
    return Y_w


def _extract_qim(Y: np.ndarray, key: bytes) -> list:
    pos  = _qim_positions(key, *Y.shape)
    bits = []
    for (br, bc, u, v) in pos:
        r, c = br * 8, bc * 8
        blk  = Y[r:r+8, c:c+8]
        if blk.shape != (8, 8):
            bits.append(0)
            continue
        C = _dct2(blk)
        bits.append(abs(round(C[u, v] / QIM_STEP)) % 2)
    return bits


def _read_frames(path: str):
    cap    = cv2.VideoCapture(path)
    fps    = cap.get(cv2.CAP_PROP_FPS) or 25.0
    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
    cap.release()
    return frames, fps, fourcc


def _key_frame_indices(n_frames: int) -> List[int]:
    return [int(i * max(1, n_frames / PAYLOAD_FRAMES)) % n_frames
            for i in range(PAYLOAD_FRAMES)]


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

    Process
    -------
    1. Decode base64 video → frames via OpenCV
    2. Statistical layer: DCT perturbation on Y-channel, every SAMPLE_EVERY-th frame
    3. Payload layer: QIM-encode all 240 bits into DCT coefficients of PAYLOAD_FRAMES
       key frames (evenly distributed across video timeline)
    4. Re-encode and return as base64

    Returns (base64_video, metadata_dict)
    """
    if not _CV2:
        raise RuntimeError("opencv-python not installed. Run: pip install opencv-python")

    raw  = base64.b64decode(video_b64)
    tin  = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    tout = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    tin.write(raw); tin.flush(); tin.close()
    tout.close()

    try:
        frames, fps, fourcc = _read_frames(tin.name)
        if not frames:
            raise ValueError("Could not decode any frames from video")

        h, w         = frames[0].shape[:2]
        payload_bits = to_bits(build_payload(model_name, timestamp, key))
        kf_set       = set(_key_frame_indices(len(frames)))
        stat_count   = 0
        out_frames   = []

        for idx, frame in enumerate(frames):
            ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
            Y     = ycrcb[:, :, 0].astype(np.float64)

            if idx % SAMPLE_EVERY == 0:
                Y = _apply_dct_stat(Y, key, alpha)
                stat_count += 1

            if idx in kf_set:
                Y = _embed_qim(Y, payload_bits, key)

            ycrcb[:, :, 0] = np.clip(Y, 0, 255).astype(np.uint8)
            out_frames.append(cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR))

        out_fourcc = fourcc if fourcc != 0 else cv2.VideoWriter_fourcc(*"XVID")
        vw = cv2.VideoWriter(tout.name, out_fourcc, fps, (w, h))
        for f in out_frames:
            vw.write(f)
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
        "total_frames":     len(frames),
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
    Stateless video watermark verification — no registry required.

    Layer 1: average DCT correlation across sampled frames
    Layer 2: majority-vote QIM extraction from PAYLOAD_FRAMES key frames
             → parse_payload() → HMAC validates in-data

    Returns dict with detected, correlation, confidence, signature_valid,
                      model_name, timestamp_unix, wm_id
    """
    if not _CV2:
        raise RuntimeError("opencv-python not installed. Run: pip install opencv-python")

    raw = base64.b64decode(video_b64)
    tmp = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    tmp.write(raw); tmp.flush(); tmp.close()

    try:
        frames, _, _ = _read_frames(tmp.name)
    finally:
        os.unlink(tmp.name)

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
    if not frames:
        return base

    # ── Layer 1: DCT correlation ──────────────────────────────────────────
    corrs = []
    for idx, frame in enumerate(frames):
        if idx % SAMPLE_EVERY == 0:
            ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
            Y     = ycrcb[:, :, 0].astype(np.float64)
            corrs.append(_dct_correlation(Y, key))
    rho = float(np.mean(corrs)) if corrs else 0.0
    kf_indices = _key_frame_indices(len(frames))
    all_bits   = []
    for idx in kf_indices:
        ycrcb = cv2.cvtColor(frames[idx], cv2.COLOR────────────────────────────────────────_BGR2YCrCb)
        Y     = ycrcb[:, :, 0].astype(np.float64)
        all_bits.append(_extract_qim(Y, key))

    voted = [
        1 if sum(b[i] for b in all_bits) > len(all_bits) / 2 else 0
        for i in range(PAYLOAD_BITS)
    ]
    raw_payload = from_bits(voted)
    payload     = parse_payload(raw_payload, key)
    sig_valid   = payload is not None
    model_name  = payload["model_name"]    if payload else None
    ts_unix     = payload["timestamp_unix"] if payload else None
    wm_id       = derive_wm_id(model_name, ts_unix, key) if payload else None

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
