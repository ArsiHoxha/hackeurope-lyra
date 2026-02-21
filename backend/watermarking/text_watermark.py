"""
Text watermarking — KGW Z-score + 2-bit/word payload steganography.

Two independent layers
----------------------
Layer 1 – Statistical (KGW-inspired):
  G_K  = PRNG(K) → green token set  (γ = 0.5 of vocabulary)
  Z    = (O_G − N·γ) / √(N·γ·(1−γ))
  Detected if Z > z_threshold

Layer 2 – Payload steganography (stateless, no registry):
  Build 26-byte signed payload  →  208 bits
  Encode 2 bits per word using 4 invisible Unicode characters:
    (0,0) → U+200B   (0,1) → U+200C
    (1,0) → U+200D   (1,1) → U+2060
  Verification extracts bits → decodes payload → validates HMAC tag.
  Requires ≥ 104 words for full payload embedding.
"""

import hashlib
from typing import Tuple, Dict, Optional

import numpy as np

from watermarking.payload import (
    PAYLOAD_BITS, WORDS_NEEDED,
    ZW_ENC, ZW_DEC, ZW_SET,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
)

VOCAB_SIZE     = 50_000
GREEN_FRACTION = 0.5


# ── Internal helpers ──────────────────────────────────────────────────────────

def _word_to_token_id(word: str) -> int:
    cleaned = word.strip(".,!?;:\"'()[]{}").lower()
    return int(hashlib.md5(cleaned.encode()).hexdigest()[:8], 16) % VOCAB_SIZE


def _build_green_set(key: bytes, gamma: float = GREEN_FRACTION) -> set:
    """G_K = PRNG(SHA256(K)) — deterministic green token set."""
    seed = int(hashlib.sha256(key).hexdigest()[:8], 16) % (2**31)
    rng  = np.random.RandomState(seed)
    return set(rng.choice(VOCAB_SIZE, int(VOCAB_SIZE * gamma), replace=False).tolist())


# ── Public API ────────────────────────────────────────────────────────────────

def embed_text_watermark(
    text:       str,
    key:        bytes,
    strength:   float = 0.8,
    model_name: Optional[str] = None,
    timestamp:  str = "",
) -> Tuple[str, Dict]:
    """
    Embed watermark into text — works with ANY text length (even 1 word).

    Process
    -------
    1. Count green tokens (statistical layer, read-only)
    2. Build 30-byte signed payload → 240 bits
    3. Calculate ZW chars needed per word:
         zw_per_word = ceil(240 / (2 * N))
       Distribute payload bits evenly across all words by appending
       multiple invisible ZW chars per word when text is short.
       Example: 5 words  → 24 ZW chars each (all still invisible)
                30 words → 4 ZW chars each
                120 words → 1 ZW char each

    Returns (watermarked_text, metadata_dict)
    """
    tokens = text.split()
    if not tokens:
        return text, {
            "embedding_method": "kgw_statistical_payload_steganography",
            "total_tokens": 0, "bits_embedded": 0,
        }

    # Layer 1: statistical analysis
    green_set   = _build_green_set(key)
    green_count = sum(1 for t in tokens if _word_to_token_id(t) in green_set)

    # Layer 2: payload steganography — adaptive ZW chars per word
    payload_bits = to_bits(build_payload(model_name, timestamp, key))  # 240 bits
    n_bits       = len(payload_bits)
    N            = len(tokens)

    # How many ZW chars (2 bits each) we need per word to cover the full payload
    total_zw = (n_bits + 1) // 2           # 120 ZW chars needed total
    zw_per_word = max(1, -(-total_zw // N)) # ceil division

    out_tokens = []
    bit_idx = 0
    for token in tokens:
        zw_str = ""
        for _ in range(zw_per_word):
            if bit_idx + 1 < n_bits:
                zw_str += ZW_ENC[(payload_bits[bit_idx], payload_bits[bit_idx + 1])]
                bit_idx += 2
            elif bit_idx < n_bits:
                zw_str += ZW_ENC[(payload_bits[bit_idx], 0)]  # pad last odd bit
                bit_idx += 2
        out_tokens.append(token + zw_str)

    bits_embedded = min(bit_idx, n_bits)

    return " ".join(out_tokens), {
        "embedding_method":  "kgw_statistical_payload_steganography",
        "green_token_count": green_count,
        "total_tokens":      N,
        "green_ratio":       round(green_count / N, 4),
        "bits_embedded":     bits_embedded,
        "zw_chars_per_word": zw_per_word,
        "payload_complete":  bits_embedded >= PAYLOAD_BITS,
    }


def verify_text_watermark(
    text:         str,
    key:          bytes,
    z_threshold:  float = 1.5,
) -> Dict:
    """
    Stateless verification — no registry required.

    Process
    -------
    1. Strip ZW chars, tokenise, compute Z-score (statistical layer)
    2. Extract ZW char sequence → reconstruct 208 bits → parse_payload()
    3. HMAC tag in payload proves authenticity without any stored record
    4. Derive wm_id deterministically from extracted (model_name, timestamp)

    Returns
    -------
    Dict with: detected, z_score, confidence, signature_valid,
               model_name, timestamp_unix, wm_id, green_count, expected_green
    """
    clean  = "".join(c for c in text if c not in ZW_SET)
    tokens = clean.split()
    N      = len(tokens)

    base: Dict = {
        "detected":        False,
        "z_score":         0.0,
        "confidence":      0.0,
        "signature_valid": False,
        "model_name":      None,
        "timestamp_unix":  None,
        "wm_id":           None,
        "green_count":     0,
        "expected_green":  0.0,
    }

    if N == 0:
        return base

    # ── Layer 1: Z-score ──────────────────────────────────────────────────
    green_set = _build_green_set(key)
    gamma     = GREEN_FRACTION
    O_G       = sum(1 for t in tokens if _word_to_token_id(t) in green_set)
    E_G       = N * gamma
    sigma_G   = np.sqrt(N * gamma * (1 - gamma))
    Z         = (O_G - E_G) / max(sigma_G, 1e-9)
    stat_conf = float(1 / (1 + np.exp(-(Z - z_threshold))))

    # ── Layer 2: payload extraction & HMAC verification ───────────────────
    extracted_bits: list = []
    for ch in text:
        if ch in ZW_DEC:
            b0, b1 = ZW_DEC[ch]
            extracted_bits.extend([b0, b1])

    payload      = None
    sig_valid    = False
    model_name   = None
    ts_unix      = None
    wm_id        = None

    if len(extracted_bits) >= PAYLOAD_BITS:
        raw     = from_bits(extracted_bits[:PAYLOAD_BITS])
        payload = parse_payload(raw, key)
        if payload:
            sig_valid  = True
            model_name = payload["model_name"]
            ts_unix    = payload["timestamp_unix"]
            wm_id      = derive_wm_id(model_name, ts_unix, key)

    # Confidence: HMAC proof beats statistical signal
    steg_conf  = 0.9 if sig_valid else 0.0
    confidence = round(float(max(stat_conf, steg_conf)), 4)
    detected   = Z > z_threshold or sig_valid

    base.update({
        "detected":        detected,
        "z_score":         round(float(Z), 6),
        "confidence":      confidence,
        "signature_valid": sig_valid,
        "model_name":      model_name,
        "timestamp_unix":  ts_unix,
        "wm_id":           wm_id,
        "green_count":     int(O_G),
        "expected_green":  round(float(E_G), 2),
    })
    return base
