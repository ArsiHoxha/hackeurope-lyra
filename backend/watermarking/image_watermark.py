"""
Image watermarking — DCT frequency-domain embedding + LSB payload layer.

Two independent layers
----------------------
Layer 1 – Statistical (DCT):
  C_w(u,v) = C(u,v) + α · W(u,v)   for (u,v) in mid-frequency band
  ρ = corr(C_w_vec, W_vec)  →  detected if ρ > threshold

Layer 2 – Payload steganography (stateless, no registry):
  Embed 208 payload bits in the LSBs of Y-channel pixels at
  key-derived pseudo-random positions (independent of DCT layer).
  Verification extracts those LSBs and validates the HMAC tag inside.
"""

import base64
import hashlib
from io import BytesIO
from typing import Tuple, Dict, Optional

import numpy as np
from PIL import Image

from watermarking.payload import (
    PAYLOAD_BITS,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
)

try:
    from scipy.fft import dctn, idctn
    _SCIPY = True
except ImportError:
    _SCIPY = False


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


# ── LSB payload helpers ───────────────────────────────────────────────────────

def _lsb_positions(key: bytes, n_pixels: int) -> np.ndarray:
    """Key-derived pseudo-random pixel indices for LSB payload embedding."""
    seed = int(hashlib.sha256(key + b"image_lsb").hexdigest()[:8], 16) % (2**31)
    return np.random.RandomState(seed).choice(n_pixels, PAYLOAD_BITS, replace=False)


def _embed_lsb_rgb(rgb: np.ndarray, payload_bits: list, key: bytes) -> np.ndarray:
    """
    Embed payload bits in LSBs of the R channel of an RGB array.

    PNG is lossless, so R-channel LSBs survive a save/load cycle exactly.
    Operation: R[pos] = (R[pos] & 0xFE) | bit
    """
    out   = rgb.copy()
    flat  = out[:, :, 0].flatten()          # R channel
    pos   = _lsb_positions(key, len(flat))
    for i, p in enumerate(pos):
        flat[p] = (int(flat[p]) & 0xFE) | int(payload_bits[i])
    out[:, :, 0] = flat.reshape(rgb.shape[:2])
    return out


def _extract_lsb_rgb(rgb: np.ndarray, key: bytes) -> bytes:
    """Extract LSB-embedded payload bits from the R channel."""
    flat = rgb[:, :, 0].flatten()
    pos  = _lsb_positions(key, len(flat))
    bits = [int(flat[p]) & 1 for p in pos]
    return from_bits(bits)


# ── Public API ────────────────────────────────────────────────────────────────

def embed_image_watermark(
    image_b64:  str,
    key:        bytes,
    alpha:      float = 8.0,
    model_name: Optional[str] = None,
    timestamp:  str = "",
) -> Tuple[str, Dict]:
    """
    Embed watermark into image (DCT statistical + LSB payload).

    DCT layer   — imperceptible frequency-domain perturbation for blind detection
    LSB layer   — 208 payload bits in Y-channel LSBs for stateless authentication

    Returns (base64_png, metadata_dict)
    """
    img_bytes = base64.b64decode(image_b64)
    img       = Image.open(BytesIO(img_bytes))

    img_ycbcr         = img.convert("YCbCr")
    y_img, cb_img, cr_img = img_ycbcr.split()
    Y = np.array(y_img, dtype=np.float64)
    H, W = Y.shape

    # ── Layer 1: DCT statistical watermark ───────────────────────────────
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

    # Reconstruct image first (DCT layer only)
    Y_w_img     = Image.fromarray(np.clip(Y_w, 0, 255).astype(np.uint8), mode="L")
    watermarked = Image.merge("YCbCr", [Y_w_img, cb_img, cr_img]).convert("RGB")

    # ── Layer 2: LSB payload embedding in RGB R-channel ───────────────────
    # PNG is lossless: R-channel LSBs survive save/load exactly.
    payload_bits = to_bits(build_payload(model_name, timestamp, key))
    rgb_array    = np.array(watermarked, dtype=np.uint8)
    rgb_array    = _embed_lsb_rgb(rgb_array, payload_bits, key)
    watermarked  = Image.fromarray(rgb_array, mode="RGB")
    buf = BytesIO()
    watermarked.save(buf, format="PNG")
    out_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return out_b64, {
        "embedding_method": "dct_lsb_dual_layer",
        "alpha":            alpha,
        "image_dimensions": f"{H}×{W}",
        "blocks_processed": blocks,
        "payload_bits":     len(payload_bits),
    }


def verify_image_watermark(
    image_b64: str,
    key:       bytes,
    threshold: float = 0.04,
) -> Dict:
    """
    Stateless verification — no registry required.

    Layer 1: DCT correlation  ρ = corr(C_w_vec, W_vec)
    Layer 2: Extract LSB payload → parse_payload() → HMAC validates in-data

    Returns dict with detected, correlation, confidence, signature_valid,
                      model_name, timestamp_unix, wm_id
    """
    img_bytes = base64.b64decode(image_b64)
    img       = Image.open(BytesIO(img_bytes))

    img_ycbcr = img.convert("YCbCr")
    y_img, _, _ = img_ycbcr.split()
    Y = np.array(y_img, dtype=np.float64)
    H, W = Y.shape

    # ── Layer 1: DCT correlation ──────────────────────────────────────────
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

    # ── Layer 2: LSB payload extraction from RGB R-channel ───────────────
    rgb_array  = np.array(img.convert("RGB"), dtype=np.uint8)
    raw        = _extract_lsb_rgb(rgb_array, key)
    payload    = parse_payload(raw, key)
    sig_valid  = payload is not None
    model_name = payload["model_name"]   if payload else None
    ts_unix    = payload["timestamp_unix"] if payload else None
    wm_id      = derive_wm_id(model_name, ts_unix, key) if payload else None

    confidence = round(float(max(stat_conf, 0.9 if sig_valid else 0.0)), 4)
    detected   = stat_detected or sig_valid

    return {
        "detected":        detected,
        "correlation":     round(rho, 6),
        "confidence":      confidence,
        "signature_valid": sig_valid,
        "model_name":      model_name,
        "timestamp_unix":  ts_unix,
        "wm_id":           wm_id,
        "threshold":       threshold,
    }
