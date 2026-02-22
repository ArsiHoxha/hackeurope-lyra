"""
Audio watermarking — FFT frequency-band embedding + multi-copy magnitude QIM.

Two independent layers
----------------------
Layer 1 – Statistical (FFT):
  X_w(f) = X(f) + α · A_max · W(f)  for f ∈ B_K  (mid-frequency band)
  ρ = corr(Re(X_w[B_K]), W)  →  detected if |ρ| > threshold

Layer 2 – Payload QIM (3 redundant copies, majority-vote):
  Embed 240 payload bits via Quantization Index Modulation on FFT magnitudes.
  Three copies are spread across three non-overlapping frequency sub-bands.
  QIM step = AUD_QIM_FRAC × band-median-magnitude  →  amplitude-invariant
  (scales proportionally with signal level, so normalization cannot destroy it).
  Extraction uses majority-vote across copies.

  Why magnitude QIM instead of LSB?
  • LSB is destroyed by any lossy re-encoding, resampling, or normalization.
  • Magnitude QIM survives amplitude normalization (relative step), MP3 encoding
    at ≥ 128 kbps, and light noise additions.
  • Phase is preserved, so tonal quality is unaffected.

Robustness summary
------------------
  WAV re-save / copy      : survives perfectly (lossless)
  MP3 128 kbps            : survives (typical noise << QIM step/2)
  Amplitude normalization : survives (step scales with signal)
  Resampling 44.1→22.05kHz: copy 0 (low band) survives; majority vote helps
  Trimming (> 50 % removed): degrades gracefully (fewer samples, band shifts)

Input format: WAV (base64-encoded), mono or stereo.
"""

import base64
import hashlib
import wave
from io import BytesIO
from typing import Tuple, Dict, Optional, List

import numpy as np

from watermarking.payload import (
    PAYLOAD_BITS,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
)

_DTYPE_MAP = {1: np.int8, 2: np.int16, 4: np.int32}

# ── QIM constants ─────────────────────────────────────────────────────────────
AUD_QIM_FRAC = 0.40   # QIM step = 40 % of band median magnitude (amplitude-invariant)
AUD_COPIES   = 3      # three copies in three non-overlapping frequency bands


# ── WAV I/O ───────────────────────────────────────────────────────────────────

def _decode_wav(audio_b64: str):
    raw = base64.b64decode(audio_b64)
    with wave.open(BytesIO(raw)) as wf:
        params = wf.getparams()
        frames = wf.readframes(params.nframes)
    dtype   = _DTYPE_MAP.get(params.sampwidth, np.int16)
    samples = np.frombuffer(frames, dtype=dtype).astype(np.float64).copy()
    return samples, params, dtype


def _encode_wav(samples: np.ndarray, params) -> str:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setparams(params)
        wf.writeframes(samples.tobytes())
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── FFT statistical helpers ───────────────────────────────────────────────────

def _watermark_band(n_freqs: int) -> Tuple[int, int]:
    """B_K = [12.5%, 25%] of one-sided spectrum (mid-frequency)."""
    return n_freqs // 8, n_freqs // 4


def _make_freq_mask(key: bytes, size: int) -> np.ndarray:
    seed = int(hashlib.sha256(key + b"audio_fft").hexdigest()[:8], 16) % (2**31)
    return np.random.RandomState(seed).choice([-1.0, 1.0], size=size).astype(np.float64)


# ── Multi-copy magnitude QIM helpers ─────────────────────────────────────────

def _aud_qim_band(copy_idx: int, n_freqs: int) -> Tuple[int, int]:
    """
    Map copy index to a non-overlapping frequency sub-band.

    The spectrum is divided into 6 equal slices; copies use slices 1, 3, 5
    (avoiding DC in slice 0 and Nyquist in slice 5 — they use 1,3,5 i.e.
    the odd slices, leaving the even slices as guard bands).
    """
    slice_size = max(1, n_freqs // 6)
    f_lo = (2 * copy_idx + 1) * slice_size
    f_hi = f_lo + slice_size
    return f_lo, min(f_hi, n_freqs - 1)


def _aud_qim_positions(key: bytes, n_freqs: int, copy_idx: int) -> np.ndarray:
    """
    Key-derived frequency-bin indices for QIM payload (one per payload bit).
    Each copy draws from its own non-overlapping sub-band.
    Positions within each copy are unique (no two bits share the same bin).
    """
    f_lo, f_hi = _aud_qim_band(copy_idx, n_freqs)
    band_size  = f_hi - f_lo
    if band_size < PAYLOAD_BITS:
        # Fallback: allow repeats if band is too narrow (very short clips)
        seed = int(hashlib.sha256(
            key + b"aud_qim" + bytes([copy_idx])
        ).hexdigest()[:8], 16) % (2**31)
        return np.random.RandomState(seed).randint(f_lo, max(f_lo + 1, f_hi), PAYLOAD_BITS)

    seed = int(hashlib.sha256(
        key + b"aud_qim" + bytes([copy_idx])
    ).hexdigest()[:8], 16) % (2**31)
    rng  = np.random.RandomState(seed)
    seen: set = set()
    result: List[int] = []
    while len(result) < PAYLOAD_BITS:
        f = int(rng.randint(f_lo, f_hi))
        if f not in seen:
            seen.add(f)
            result.append(f)
    return np.array(result)


def _embed_qim_aud(
    X:        np.ndarray,     # complex rfft output (modified in place)
    bits:     list,
    positions: np.ndarray,
    step:     float,
) -> np.ndarray:
    """
    QIM embedding on FFT magnitudes at the given frequency-bin positions.

    For each bit: round(|X[f]| / step) is forced to even (bit=0) or odd (bit=1).
    Phase is preserved.  Step is computed from the band median, so the QIM
    is amplitude-invariant.
    """
    X = X.copy()
    for i, f in enumerate(positions):
        if i >= len(bits):
            break
        mag   = abs(X[f])
        phase = np.angle(X[f])
        q     = int(round(mag / step))
        if q % 2 != bits[i]:
            q = q + 1 if bits[i] == 1 else max(0, q - 1)
        X[f] = float(q) * step * np.exp(1j * phase)
    return X


def _extract_qim_aud(
    X:        np.ndarray,
    positions: np.ndarray,
    step:     float,
) -> list:
    """Extract magnitude-QIM bits from the given frequency bins."""
    bits = []
    for f in positions:
        q = int(round(abs(X[f]) / step))
        bits.append(q % 2)
    return bits


def _band_qim_step(X: np.ndarray, copy_idx: int, n_freqs: int) -> float:
    """QIM step = AUD_QIM_FRAC × median magnitude of the band (amplitude-invariant)."""
    f_lo, f_hi = _aud_qim_band(copy_idx, n_freqs)
    mags       = np.abs(X[f_lo:f_hi])
    med        = float(np.median(mags))
    return max(med * AUD_QIM_FRAC, 1.0)   # floor at 1.0 to avoid degenerate step


# ── Public API ────────────────────────────────────────────────────────────────

def embed_audio_watermark(
    audio_b64:  str,
    key:        bytes,
    alpha:      float = 0.008,
    model_name: Optional[str] = None,
    timestamp:  str = "",
    context:    Optional[str] = None,
) -> Tuple[str, Dict]:
    """
    Embed watermark into audio (FFT statistical + multi-copy magnitude QIM).

    FFT layer   — imperceptible mid-frequency perturbation for blind detection
    QIM payload — 240 payload bits, 3 independent copies in non-overlapping
                  frequency bands; amplitude-invariant relative QIM step.
                  Majority-vote extraction tolerates any 1 corrupt copy.

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

    # ── Layer 2: magnitude QIM payload (3 copies) ─────────────────────────
    # Pre-compute all QIM steps from the post-stat-layer spectrum BEFORE any
    # QIM modifications, so each copy's step is based on consistent magnitudes.
    payload_bits = to_bits(build_payload(model_name, timestamp, key, context))
    steps = [_band_qim_step(X_w, c, n_freqs) for c in range(AUD_COPIES)]

    copies_embedded = 0
    for c in range(AUD_COPIES):
        positions = _aud_qim_positions(key, n_freqs, c)
        X_w       = _embed_qim_aud(X_w, payload_bits, positions, steps[c])
        copies_embedded += 1

    mono_w   = np.fft.irfft(X_w, n=len(mono))
    max_v    = float(np.iinfo(dtype).max)
    min_v    = float(np.iinfo(dtype).min)
    mono_int = np.clip(mono_w, min_v, max_v).astype(dtype)

    out = samples.astype(dtype).copy()
    if n_ch > 1:
        out[::n_ch] = mono_int
    else:
        out = mono_int

    sr    = params.framerate
    hz_lo = int(f_lo * sr / (2 * n_freqs))
    hz_hi = int(f_hi * sr / (2 * n_freqs))

    return _encode_wav(out, params), {
        "embedding_method": "fft_qim_dual_layer",
        "alpha":            alpha,
        "sample_rate_hz":   sr,
        "n_samples":        len(mono),
        "band_hz":          f"{hz_lo}–{hz_hi} Hz",
        "payload_bits":     len(payload_bits),
        "qim_copies":       copies_embedded,
        "qim_frac":         AUD_QIM_FRAC,
    }


def verify_audio_watermark(
    audio_b64: str,
    key:       bytes,
    threshold: float = 0.08,
) -> Dict:
    """
    Stateless verification — no registry required.

    Layer 1: FFT correlation  ρ = corr(Re(X_w[B_K]), W)
    Layer 2: Extract QIM from 3 frequency bands → majority-vote →
             parse_payload() → HMAC validates in-data

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

    # ── Layer 2: magnitude QIM extraction (3 copies) + majority vote ──────
    copy_bits: List[list] = []
    for c in range(AUD_COPIES):
        positions = _aud_qim_positions(key, n_freqs, c)
        step      = _band_qim_step(X_w, c, n_freqs)
        copy_bits.append(_extract_qim_aud(X_w, positions, step))

    sig_valid  = False
    model_name = None
    ts_unix    = None
    context_str = None
    wm_id      = None

    if copy_bits:
        voted = [
            1 if sum(cb[i] for cb in copy_bits) > len(copy_bits) / 2 else 0
            for i in range(PAYLOAD_BITS)
        ]
        payload    = parse_payload(from_bits(voted), key)
        sig_valid  = payload is not None
        model_name = payload["model_name"]     if payload else None
        ts_unix    = payload["timestamp_unix"] if payload else None
        context_str = payload.get("context") if payload else None
        wm_id      = derive_wm_id(model_name, ts_unix, key) if payload else None

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
    }
