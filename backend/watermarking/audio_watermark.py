"""
Audio watermarking — FFT frequency-band embedding + LSB payload layer.

Two independent layers
----------------------
Layer 1 – Statistical (FFT):
  X_w(f) = X(f) + α · A_max · W(f)  for f ∈ B_K  (mid-frequency band)
  ρ = corr(Re(X_w[B_K]), W)  →  detected if |ρ| > threshold

Layer 2 – Payload steganography (stateless, no registry):
  Embed 208 payload bits in the LSBs of audio samples at key-derived
  pseudo-random positions (independent of FFT layer).
  Verification extracts those LSBs and validates the HMAC tag inside.

Input format: WAV (base64-encoded), mono or stereo.
"""

import base64
import hashlib
import wave
from io import BytesIO
from typing import Tuple, Dict, Optional

import numpy as np

from watermarking.payload import (
    PAYLOAD_BITS,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
)

_DTYPE_MAP = {1: np.int8, 2: np.int16, 4: np.int32}


# ── WAV I/O ───────────────────────────────────────────────────────────────────

def _decode_wav(audio_b64: str):
    raw = base64.b64decode(audio_b64)
    with wave.open(BytesIO(raw)) as wf:
        params    = wf.getparams()
        frames    = wf.readframes(params.nframes)
    dtype   = _DTYPE_MAP.get(params.sampwidth, np.int16)
    samples = np.frombuffer(frames, dtype=dtype).astype(np.float64).copy()
    return samples, params, dtype


def _encode_wav(samples: np.ndarray, params) -> str:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setparams(params)
        wf.writeframes(samples.tobytes())
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── FFT helpers ───────────────────────────────────────────────────────────────

def _watermark_band(n_freqs: int) -> Tuple[int, int]:
    """B_K = [12.5%, 25%] of one-sided spectrum (mid-frequency)."""
    return n_freqs // 8, n_freqs // 4


def _make_freq_mask(key: bytes, size: int) -> np.ndarray:
    seed = int(hashlib.sha256(key + b"audio_fft").hexdigest()[:8], 16) % (2**31)
    return np.random.RandomState(seed).choice([-1.0, 1.0], size=size).astype(np.float64)


# ── LSB payload helpers ───────────────────────────────────────────────────────

def _lsb_positions(key: bytes, n_samples: int) -> np.ndarray:
    """Key-derived pseudo-random sample indices for LSB payload embedding."""
    seed = int(hashlib.sha256(key + b"audio_lsb").hexdigest()[:8], 16) % (2**31)
    return np.random.RandomState(seed).choice(n_samples, PAYLOAD_BITS, replace=False)


def _embed_lsb(samples_int: np.ndarray, payload_bits: list, key: bytes) -> np.ndarray:
    """
    Embed payload bits in LSBs of audio samples at key-derived positions.

    Operation: sample[pos] = (sample[pos] & ~1) | bit
    Modifies the least significant bit only — inaudible.
    """
    out = samples_int.copy()
    pos = _lsb_positions(key, len(out))
    for i, p in enumerate(pos):
        out[p] = (int(out[p]) & ~1) | int(payload_bits[i])
    return out


def _extract_lsb(samples_int: np.ndarray, key: bytes) -> bytes:
    """Extract LSB-embedded payload bits and reconstruct bytes."""
    pos  = _lsb_positions(key, len(samples_int))
    bits = [int(samples_int[p]) & 1 for p in pos]
    return from_bits(bits)


# ── Public API ────────────────────────────────────────────────────────────────

def embed_audio_watermark(
    audio_b64:  str,
    key:        bytes,
    alpha:      float = 0.008,
    model_name: Optional[str] = None,
    timestamp:  str = "",
) -> Tuple[str, Dict]:
    """
    Embed watermark into audio (FFT statistical + LSB payload).

    FFT layer   — imperceptible mid-frequency perturbation for blind detection
    LSB layer   — 208 payload bits in sample LSBs for stateless authentication

    Returns (base64_wav, metadata_dict)
    """
    samples, params, dtype = _decode_wav(audio_b64)
    n_ch = params.nchannels

    mono = samples[::n_ch].copy() if n_ch > 1 else samples.copy()

    # ── Layer 1: FFT statistical watermark ───────────────────────────────
    X       = np.fft.rfft(mono)
    n_freqs = len(X)
    f_lo, f_hi = _watermark_band(n_freqs)
    W          = _make_freq_mask(key, f_hi - f_lo)
    A_max      = float(np.max(np.abs(mono))) or 1.0

    X_w = X.copy()
    X_w[f_lo:f_hi] += alpha * A_max * W

    mono_w = np.fft.irfft(X_w, n=len(mono))

    max_v = float(np.iinfo(dtype).max)
    min_v = float(np.iinfo(dtype).min)
    mono_int = np.clip(mono_w, min_v, max_v).astype(dtype)

    # Rebuild interleaved sample array
    out = samples.astype(dtype).copy()
    if n_ch > 1:
        out[::n_ch] = mono_int
    else:
        out = mono_int

    # ── Layer 2: LSB payload embedding ───────────────────────────────────
    # Embed 208 signed payload bits at key-derived sample positions
    payload_bits = to_bits(build_payload(model_name, timestamp, key))
    out          = _embed_lsb(out, payload_bits, key)

    sr    = params.framerate
    hz_lo = int(f_lo * sr / (2 * n_freqs))
    hz_hi = int(f_hi * sr / (2 * n_freqs))

    return _encode_wav(out, params), {
        "embedding_method": "fft_lsb_dual_layer",
        "alpha":            alpha,
        "sample_rate_hz":   sr,
        "n_samples":        len(mono),
        "band_hz":          f"{hz_lo}–{hz_hi} Hz",
        "payload_bits":     len(payload_bits),
    }


def verify_audio_watermark(
    audio_b64: str,
    key:       bytes,
    threshold: float = 0.08,
) -> Dict:
    """
    Stateless verification — no registry required.

    Layer 1: FFT correlation  ρ = corr(Re(X_w[B_K]), W)
    Layer 2: Extract LSB payload → parse_payload() → HMAC validates in-data

    Returns dict with detected, correlation, confidence, signature_valid,
                      model_name, timestamp_unix, wm_id
    """
    samples, params, dtype = _decode_wav(audio_b64)
    n_ch = params.nchannels
    mono = samples[::n_ch].copy() if n_ch > 1 else samples.copy()

    # ── Layer 1: FFT correlation ──────────────────────────────────────────
    X_w     = np.fft.rfft(mono)
    n_freqs = len(X_w)
    f_lo, f_hi = _watermark_band(n_freqs)
    W          = _make_freq_mask(key, f_hi - f_lo)

    X_band = np.real(X_w[f_lo:f_hi])
    X_norm = X_band - X_band.mean()
    W_norm = W - W.mean()

    rho = 0.0
    if np.std(X_norm) > 1e-9 and np.std(W_norm) > 1e-9:
        rho = float(np.corrcoef(X_norm, W_norm)[0, 1])

    stat_detected = abs(rho) > threshold
    stat_conf     = float(np.clip((abs(rho) - threshold) / max(0.5 - threshold, 0.01), 0, 1))

    # ── Layer 2: LSB payload extraction & HMAC verification ──────────────
    mono_int   = mono.astype(dtype)
    raw        = _extract_lsb(mono_int, key)
    payload    = parse_payload(raw, key)
    sig_valid  = payload is not None
    model_name = payload["model_name"]    if payload else None
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
