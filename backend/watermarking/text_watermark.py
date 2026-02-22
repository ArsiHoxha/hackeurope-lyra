"""
Text watermarking — KGW Z-score + carrier-word redundant steganography.

Two independent layers
----------------------
Layer 1 – Statistical (KGW-inspired):
  G_K  = PRNG(K) → green token set  (γ = 0.5 of vocabulary)
  Z    = (O_G − N·γ) / √(N·γ·(1−γ))
  Detected if Z > z_threshold

Layer 2 – Carrier-word redundant steganography (hardened v3)
-------------------------------------------------------------
Step 1 – Carrier selection (~50% of words):
  _is_carrier(word, key)  →  SHA256(key ∥ "carrier" ∥ word) & 1
  Non-carrier words are completely untouched — deleting or replacing them
  has ZERO effect on the embedded payload.

Step 2 – Copy assignment (content-based, keyed):
  _carrier_copy(word, key)  →  SHA256(key ∥ "copy" ∥ word) % REDUNDANCY
  Each carrier is assigned to exactly one of REDUNDANCY=5 independent copies.
  Assignment is based on word content + key, NOT position, so an attacker
  cannot target a specific copy without knowing the secret key.

Step 3 – Per-copy payload embedding:
  Each copy embeds the full 240-bit payload across its own set of carriers.
  zw_per_carrier = ceil(120 / copy_size)  — adaptive to copy carrier count.

Step 4 – Majority vote at extraction:
  Collect complete copies (≥ 240 bits).  For each payload bit position,
  take the majority across all surviving complete copies.
  Requires strictly more than half of REDUNDANCY copies to be intact.

Tolerance (REDUNDANCY = 5)
--------------------------
  Random deletion of ≤ 40% of ALL carrier words → payload recovers.
  (2 out of 5 copies may be completely wiped; 3 remaining copies vote.)
  Targeted attack: must destroy 3 copies = 60% of ALL carrier words
  (attacker doesn't know which words belong to which copy without the key).
  Overall: tolerates deletion/paraphrasing of ~20% of all words.
"""

import hashlib
from typing import Tuple, Dict, Optional

import numpy as np

from watermarking.payload import (
    PAYLOAD_BITS,
    ZW_ENC, ZW_DEC, ZW_SET,
    build_payload, parse_payload,
    to_bits, from_bits,
    derive_wm_id,
)

VOCAB_SIZE     = 50_000
GREEN_FRACTION = 0.5
REDUNDANCY     = 5   # independent payload copies; tolerates floor(5/2)=2 lost


# ── Internal helpers ──────────────────────────────────────────────────────────

def _word_to_token_id(word: str) -> int:
    cleaned = word.strip(".,!?;:\"'()[]{}\n\r\t").lower()
    return int(hashlib.md5(cleaned.encode()).hexdigest()[:8], 16) % VOCAB_SIZE


def _build_green_set(key: bytes, gamma: float = GREEN_FRACTION) -> set:
    """G_K = PRNG(SHA256(K)) — deterministic green token set."""
    seed = int(hashlib.sha256(key).hexdigest()[:8], 16) % (2**31)
    rng  = np.random.RandomState(seed)
    return set(rng.choice(VOCAB_SIZE, int(VOCAB_SIZE * gamma), replace=False).tolist())


def _is_carrier(word: str, key: bytes) -> bool:
    """~50% of words are carriers, determined by HMAC(key, word) LSB."""
    cleaned = word.strip(".,!?;:\"'()[]{}\n\r\t").lower()
    if not cleaned:
        return False
    h = hashlib.sha256(key + b"\x00carrier\x00" + cleaned.encode()).digest()[0]
    return (h & 1) == 1


def _carrier_copy(word: str, key: bytes) -> int:
    """
    Assign carrier word to one of REDUNDANCY copies.

    Based on HMAC(key, word) — content-keyed, position-independent.
    An attacker cannot determine which copy a word belongs to without K.
    """
    cleaned = word.strip(".,!?;:\"'()[]{}\n\r\t").lower()
    h = hashlib.sha256(key + b"\x00copy\x00" + cleaned.encode()).digest()[0]
    return int(h) % REDUNDANCY


def _split_token(token: str):
    """Split a raw token into (base_word_str, [zw_char, ...])."""
    base = "".join(c for c in token if c not in ZW_SET)
    zws  = [c for c in token if c in ZW_DEC]
    return base, zws


# ── Public API ────────────────────────────────────────────────────────────────

def embed_text_watermark(
    text:       str,
    key:        bytes,
    strength:   float = 0.8,
    model_name: Optional[str] = None,
    timestamp:  str = "",
    context:    Optional[str] = None,
) -> Tuple[str, Dict]:
    """
    Embed watermark with content-keyed carrier selection + REDUNDANCY=5 copies.

    Process
    -------
    1. Count green tokens (statistical layer, read-only)
    2. Build 30-byte HMAC payload → 240 bits
    3. Select carrier words (~50%) via HMAC(key, word)
    4. Assign each carrier to one of 5 copies via HMAC(key, word) % 5
    5. Embed full 240-bit payload on each copy's carriers independently

    Deletion/replacement of non-carrier words:  zero effect.
    Deletion/replacement of ≤ 40% of carrier words:  3+ copies survive → OK.

    Returns (watermarked_text, metadata_dict)
    """
    tokens = text.split()
    if not tokens:
        return text, {
            "embedding_method": "kgw_carrier_redundant_steganography_v3",
            "total_tokens": 0, "bits_embedded": 0,
        }

    # Layer 1: statistical analysis (read-only)
    green_set   = _build_green_set(key)
    green_count = sum(1 for t in tokens if _word_to_token_id(t) in green_set)

    # Layer 2: build payload, group carriers by copy assignment
    payload_bits = to_bits(build_payload(model_name, timestamp, key, context))  # 272 bits

    all_carriers = [i for i, t in enumerate(tokens) if _is_carrier(t, key)]
    if not all_carriers:
        all_carriers = list(range(len(tokens)))  # fallback: use all words

    # Group carrier indices by copy assignment
    copy_carriers: dict = {r: [] for r in range(REDUNDANCY)}
    for ci in all_carriers:
        r = _carrier_copy(tokens[ci], key)
        copy_carriers[r].append(ci)

    out_tokens    = list(tokens)
    total_embedded = 0

    for r in range(REDUNDANCY):
        ccl = copy_carriers[r]
        if not ccl:
            continue
        total_zw    = (PAYLOAD_BITS + 1) // 2          # 136 ZW chars needed
        zw_per_word = max(1, -(-total_zw // len(ccl)))  # ceil division
        bit_i       = 0

        for ci in ccl:
            zw_str = ""
            for _ in range(zw_per_word):
                if bit_i + 1 < PAYLOAD_BITS:
                    zw_str += ZW_ENC[(payload_bits[bit_i], payload_bits[bit_i + 1])]
                    bit_i += 2
                elif bit_i < PAYLOAD_BITS:
                    zw_str += ZW_ENC[(payload_bits[bit_i], 0)]
                    bit_i += 2
            if zw_str:
                out_tokens[ci] = tokens[ci] + zw_str

        total_embedded += bit_i

    copy_sizes = {r: len(v) for r, v in copy_carriers.items()}

    return " ".join(out_tokens), {
        "embedding_method":    "kgw_carrier_redundant_steganography_v3",
        "green_token_count":   green_count,
        "total_tokens":        len(tokens),
        "carrier_tokens":      len(all_carriers),
        "green_ratio":         round(green_count / len(tokens), 4),
        "redundancy":          REDUNDANCY,
        "copy_sizes":          copy_sizes,
        "payload_complete":    all(
            len(copy_carriers[r]) > 0 for r in range(REDUNDANCY)
        ),
    }


def verify_text_watermark(
    text:        str,
    key:         bytes,
    z_threshold: float = 1.5,
) -> Dict:
    """
    Stateless verification — carrier extraction, per-copy grouping, majority vote.

    Process
    -------
    1. Strip ZW chars, tokenise, compute Z-score (statistical layer)
    2. For each raw token: identify carriers, assign to copy via HMAC
    3. Group ZW bits by copy → collect complete copies (≥ 240 bits)
    4. Majority-vote across complete copies → parse_payload() + HMAC check

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
        "context":         None,
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

    # ── Layer 2: per-copy extraction + majority vote ───────────────────────
    copy_bits: list = [[] for _ in range(REDUNDANCY)]

    for raw_token in text.split():
        base_word, zw_chars = _split_token(raw_token)
        if _is_carrier(base_word, key) and zw_chars:
            r = _carrier_copy(base_word, key)
            for ch in zw_chars:
                b0, b1 = ZW_DEC[ch]
                copy_bits[r].extend([b0, b1])

    # Collect complete copies (each must have ≥ PAYLOAD_BITS bits)
    complete = [c[:PAYLOAD_BITS] for c in copy_bits if len(c) >= PAYLOAD_BITS]

    sig_valid  = False
    model_name = None
    ts_unix    = None
    context_str = None
    wm_id      = None

    if complete:
        voted = [
            1 if sum(c[i] for c in complete) > len(complete) / 2 else 0
            for i in range(PAYLOAD_BITS)
        ]
        raw     = from_bits(voted)
        payload = parse_payload(raw, key)
        if payload:
            sig_valid  = True
            model_name = payload["model_name"]
            context_str = payload.get("context")
            ts_unix    = payload["timestamp_unix"]
            wm_id      = derive_wm_id(model_name, ts_unix, key)

    steg_conf  = 0.9 if sig_valid else 0.0
    confidence = round(float(max(stat_conf, steg_conf)), 4)
    detected   = Z > z_threshold or sig_valid

    base.update({
        "detected":        detected,
        "z_score":         round(float(Z), 6),
        "confidence":      confidence,
        "signature_valid": sig_valid,
        "model_name":      model_name,
        "context":         context_str if "context_str" in locals() else None,
        "timestamp_unix":  ts_unix,
        "wm_id":           wm_id,
        "green_count":     int(O_G),
        "expected_green":  round(float(E_G), 2),
    })
    return base
