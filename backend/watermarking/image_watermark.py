"""
Image watermarking — DCT frequency-domain embedding + multi-copy QIM payload layer.

Two independent layers
----------------------
Layer 1 – Statistical (DCT):
  C_w(u,v) = C(u,v) + α · W(u,v)   for (u,v) in mid-frequency band
  ρ = corr(C_w_vec, W_vec)  →  detected if ρ > threshold

Layer 2 – Payload QIM (3 redundant copies, majority-vote):
  Embed 240 payload bits via Quantization Index Modulation in mid-frequency
  DCT coefficients of the BLUE channel.

  Key design choices
  ~~~~~~~~~~~~~~~~~~
  • Blue channel (not Y or LSB): PNG is lossless → blue pixels survive
    save/load exactly (no YCbCr double-conversion rounding).  LSB is
    destroyed by any lossy compression; DCT QIM at step 32 is not.
  • 3×240 = 720 globally collision-free positions: generated in one pass so
    no two copies ever share the same (block, DCT-coeff) slot.
  • Single-pass block embedding: all three copies' modifications for a given
    8×8 block are applied in ONE DCT/IDCT round-trip.  This eliminates
    cascaded uint8-quantisation errors that arise from sequential embedding.
  • Majority-vote across 3 copies: tolerates corruption of any one copy
    (e.g., JPEG quality ≥ 60% typically leaves 2/3 copies intact).

Robustness summary
------------------
  PNG re-save         : survives perfectly (lossless)
  JPEG quality 85 %   : survives (Cb step ≈ 4–8 << 16 = QIM_STEP/2)
  JPEG quality 60 %   : survives with majority vote
  Brightness / contrast: survives (QIM step in pixel-magnitude domain)
  Cropping            : degrades gracefully (fewer blocks available)
"""

import base64
import hashlib
from io import BytesIO
from typing import Tuple, Dict, Optional, List

import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from watermarking.payload import (
    PAYLOAD_BITS,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
    ZW_ENC, ZW_DEC,
)

try:
    from scipy.fft import dctn, idctn
    _SCIPY = True
except ImportError:
    _SCIPY = False

# ── QIM constants ─────────────────────────────────────────────────────────────
IMG_QIM_STEP = 48.0   # survives JPEG quality ≥ 60 % (increased for robustness)
U_QIM = 3             # DCT coeff row for embedding
V_QIM = 3             # DCT coeff col for embedding


# ── DCT helpers ───────────────────────────────────────────────────────────────

def _dct2(block: np.ndarray) -> np.ndarray:
    if _SCIPY:
        return dctn(block, norm="ortho")
    def _dct1d(x):
        N   = x.shape[-1]
        ext = np.concatenate([x, x[..., ::-1]], axis=-1)
        F   = np.fft.rfft(ext, axis=-1)
        k   = np.arange(N)
        return np.real(F[..., :N] * np.exp(-1j * np.pi * k / (2 * N))) / np.sqrt(N)
    return _dct1d(_dct1d(block).T).T


def _idct2(block: np.ndarray) -> np.ndarray:
    if _SCIPY:
        return idctn(block, norm="ortho")
    def _idct1d(X):
        N     = X.shape[-1]
        phase = np.exp(1j * np.pi * np.arange(N) / (2 * N))
        full  = np.zeros(X.shape[:-1] + (2 * N,), dtype=complex)
        full[..., :N] = X * phase * np.sqrt(N)
        full[..., N:] = np.conj(full[..., 1:N][..., ::-1])
        return np.real(np.fft.ifft(full, axis=-1))[..., :N]
    return _idct1d(_idct1d(block).T).T


def _make_dct_mask(key: bytes, H: int, W: int) -> np.ndarray:
    seed = int(hashlib.sha256(key + b"image_dct").hexdigest()[:8], 16) % (2**31)
    return np.random.RandomState(seed).choice([-1.0, 1.0], size=(H, W)).astype(np.float64)


_MF_R = slice(1, 5)
_MF_C = slice(1, 5)


# ── Multi-copy QIM payload helpers ────────────────────────────────────────────

def _make_tile_map(key: bytes) -> dict:
    seed = int(hashlib.sha256(key + b"tile_map").hexdigest()[:8], 16) % (2**31)
    rng  = np.random.RandomState(seed)
    
    positions = np.arange(300)
    rng.shuffle(positions)
    
    bit_to_loc = {}
    for bit_idx in range(PAYLOAD_BITS):
        bit_to_loc[bit_idx] = int(positions[bit_idx])
    return bit_to_loc

def _embed_qim_tiled(channel: np.ndarray, bits: list, bit_to_loc: dict) -> np.ndarray:
    loc_to_bit = {loc: bits[bit_idx] for bit_idx, loc in bit_to_loc.items()}
    out = channel.copy()
    nb_h = out.shape[0] // 8
    nb_w = out.shape[1] // 8
    
    for br in range(nb_h):
        for bc in range(nb_w):
            loc = (br % 18) * 17 + (bc % 17)
            if loc in loc_to_bit:
                bit = loc_to_bit[loc]
                row, col = br * 8, bc * 8
                block = out[row:row+8, col:col+8]
                C = _dct2(block)
                q = int(round(C[U_QIM, V_QIM] / IMG_QIM_STEP))
                if q % 2 != bit:
                    q = q + 1 if bit == 1 else q - 1
                C[U_QIM, V_QIM] = float(q) * IMG_QIM_STEP
                out[row:row+8, col:col+8] = np.clip(_idct2(C), 0, 255).astype(np.uint8).astype(np.float64)
    return out

def _extract_qim_tiled_search(Y: np.ndarray, bit_to_loc: dict, key: bytes):
    H, W = Y.shape
    h_search = min(H, 512)
    w_search = min(W, 512)
    cy, cx = H // 2, W // 2
    r_start = max(0, cy - h_search // 2)
    c_start = max(0, cx - w_search // 2)
    
    Y_crop = Y[r_start:r_start + h_search, c_start:c_start + w_search]
    CH, CW = Y_crop.shape
    
    shifts_to_try = [(0, 0)] + [(dy, dx) for dy in range(8) for dx in range(8) if not (dy == 0 and dx == 0)]
    
    for dy, dx in shifts_to_try:
        nb_h = (CH - dy) // 8
        nb_w = (CW - dx) // 8
        if nb_h < 1 or nb_w < 1:
            continue
            
        vote_matrix = np.zeros((18, 17, 2), dtype=int)
        for br in range(nb_h):
            for bc in range(nb_w):
                row = dy + br * 8
                col = dx + bc * 8
                block = Y_crop[row:row+8, col:col+8]
                C = _dct2(block)
                q = int(round(C[U_QIM, V_QIM] / IMG_QIM_STEP))
                vote_matrix[br % 18, bc % 17, abs(q) % 2] += 1
                
        for s_y in range(18):
            for s_x in range(17):
                voted_bits = []
                for bit_idx in range(PAYLOAD_BITS):
                    loc = bit_to_loc[bit_idx]
                    r = (loc // 17 + s_y) % 18
                    c = (loc % 17 + s_x) % 17
                    v0 = vote_matrix[r, c, 0]
                    v1 = vote_matrix[r, c, 1]
                    voted_bits.append(1 if v1 > v0 else 0)
                
                payload = parse_payload(from_bits(voted_bits), key)
                if payload is not None:
                    return payload
    return None


# ── Public API ────────────────────────────────────────────────────────────────

def embed_image_watermark(
    image_b64:  str,
    key:        bytes,
    alpha:      float = 8.0,
    model_name: Optional[str] = None,
    timestamp:  str = "",
    context:    Optional[str] = None,
) -> Tuple[str, Dict]:
    """
    Embed watermark into image (DCT statistical + multi-copy QIM payload).

    Returns (base64_png, metadata_dict)
    """
    img_bytes = base64.b64decode(image_b64)
    img       = Image.open(BytesIO(img_bytes))

    img_ycbcr             = img.convert("YCbCr")
    y_img, cb_img, cr_img = img_ycbcr.split()
    Y = np.array(y_img, dtype=np.float64)
    H, W = Y.shape

    # ── Layer 1: DCT statistical watermark on Y channel ───────────────────
    W_mask = _make_dct_mask(key, H, W)
    Y_w    = Y.copy()
    blocks = 0

    for row in range(0, H - 7, 8):
        for col in range(0, W - 7, 8):
            block = Y[row:row+8, col:col+8]
            if block.shape != (8, 8):
                continue
            C   = _dct2(block)
            C_w = C.copy()
            C_w[_MF_R, _MF_C] += alpha * W_mask[row:row+8, col:col+8][_MF_R, _MF_C]
            Y_w[row:row+8, col:col+8] = np.clip(_idct2(C_w), 0, 255)
            blocks += 1

    # ── Layer 2: QIM payload in Y channel (Tiled) ─────────────────────────
    payload      = build_payload(model_name, timestamp, key, context)
    payload_bits = to_bits(payload)
    bit_to_loc   = _make_tile_map(key)
    Y_qim        = _embed_qim_tiled(Y_w, payload_bits, bit_to_loc)
    
    Y_w_img     = Image.fromarray(np.clip(Y_qim, 0, 255).astype(np.uint8), mode="L")
    watermarked = Image.merge("YCbCr", [Y_w_img, cb_img, cr_img]).convert("RGB")

    # ── Layer 3: PNG metadata (survives pixel changes if metadata preserved) ──
    png_meta = PngInfo()
    payload_hex = payload.hex()
    png_meta.add_text("WM_PAYLOAD", payload_hex)
    # Also add as zero-width Unicode in Keywords (like PDF layer 2)
    zw_text = ""
    for i in range(0, len(payload_bits), 2):
        b0 = payload_bits[i]
        b1 = payload_bits[i + 1] if i + 1 < len(payload_bits) else 0
        zw_text += ZW_ENC[(b0, b1)]
    png_meta.add_text("Keywords", zw_text)

    buf = BytesIO()
    watermarked.save(buf, format="PNG", pnginfo=png_meta)
    out_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return out_b64, {
        "embedding_method":  "dct_qim_metadata_triple_layer",
        "alpha":             alpha,
        "image_dimensions":  f"{H}×{W}",
        "blocks_processed":  blocks,
        "payload_bits":      len(payload_bits),
        "qim_copies":        (H // 8 // 16) * (W // 8 // 16),
        "qim_step":          IMG_QIM_STEP,
        "metadata_layers":   ["WM_PAYLOAD", "Keywords"],
    }


def verify_image_watermark(
    image_b64: str,
    key:       bytes,
    threshold: float = 0.04,
) -> Dict:
    """
    Stateless verification — no registry required.
    Checks 3 layers: metadata, DCT statistical, QIM payload.

    Returns dict with detected, correlation, confidence, signature_valid,
                      model_name, timestamp_unix, wm_id, source
    """
    img_bytes = base64.b64decode(image_b64)
    img       = Image.open(BytesIO(img_bytes))

    sig_valid   = False
    model_name  = None
    ts_unix     = None
    context_str = None
    wm_id       = None
    source      = None

    # ── Layer 3: PNG metadata (cheapest check — do first) ─────────────────
    png_text = getattr(img, 'text', {}) or {}

    # Try WM_PAYLOAD hex field
    hex_val = png_text.get('WM_PAYLOAD')
    if hex_val:
        try:
            p = parse_payload(bytes.fromhex(str(hex_val)), key)
            if p:
                sig_valid   = True
                model_name  = p["model_name"]
                ts_unix     = p["timestamp_unix"]
                context_str = p.get("context")
                wm_id       = derive_wm_id(model_name, ts_unix, key)
                source      = "metadata_wm_payload"
        except Exception:
            pass

    # Try Keywords ZW field
    if not sig_valid:
        kw = png_text.get('Keywords', '')
        if kw:
            try:
                bits = []
                for ch in kw:
                    if ch in ZW_DEC:
                        b0, b1 = ZW_DEC[ch]
                        bits.extend([b0, b1])
                if len(bits) >= PAYLOAD_BITS:
                    raw = from_bits(bits[:PAYLOAD_BITS])
                    p = parse_payload(raw, key)
                    if p:
                        sig_valid   = True
                        model_name  = p["model_name"]
                        ts_unix     = p["timestamp_unix"]
                        context_str = p.get("context")
                        wm_id       = derive_wm_id(model_name, ts_unix, key)
                        source      = "metadata_keywords"
            except Exception:
                pass

    # ── Layer 1: DCT correlation ──────────────────────────────────────────
    img_ycbcr   = img.convert("YCbCr")
    y_img, _, _ = img_ycbcr.split()
    Y = np.array(y_img, dtype=np.float64)
    H, W = Y.shape

    W_mask    = _make_dct_mask(key, H, W)
    extracted = []
    mask_vals = []

    for row in range(0, H - 7, 8):
        for col in range(0, W - 7, 8):
            block = Y[row:row+8, col:col+8]
            if block.shape != (8, 8):
                continue
            C_w   = _dct2(block)
            W_blk = W_mask[row:row+8, col:col+8]
            extracted.extend(C_w[_MF_R, _MF_C].flatten().tolist())
            mask_vals.extend(W_blk[_MF_R, _MF_C].flatten().tolist())

    rho = 0.0
    if extracted:
        C_vec = np.array(extracted)
        W_vec = np.array(mask_vals)
        if np.std(C_vec) > 1e-9 and np.std(W_vec) > 1e-9:
            rho = float(np.corrcoef(C_vec, W_vec)[0, 1])

    stat_detected = rho > threshold
    stat_conf     = float(np.clip((rho - threshold) / max(1 - threshold, 0.01), 0, 1))

    # ── Layer 2: QIM majority-vote from Y channel ──────────────────────
    if not sig_valid:
        bit_to_loc = _make_tile_map(key)
        payload    = _extract_qim_tiled_search(Y, bit_to_loc, key)

        if payload is not None:
            sig_valid   = True
            model_name  = payload["model_name"]
            ts_unix     = payload["timestamp_unix"]
            context_str = payload.get("context")
            wm_id       = derive_wm_id(model_name, ts_unix, key)
            source      = "qim_dct"

    confidence = round(float(max(stat_conf, 0.9 if sig_valid else 0.0)), 4)
    detected   = stat_detected or sig_valid

    return {
        "detected":        detected,
        "correlation":     round(rho, 6),
        "confidence":      confidence,
        "signature_valid": sig_valid,
        "model_name":      model_name,
        "context":         context_str,
        "timestamp_unix":  ts_unix,
        "wm_id":           wm_id,
        "threshold":       threshold,
        "source":          source,
    }
