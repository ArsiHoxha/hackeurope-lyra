"""
Cryptographic utilities for the multi-modal watermarking system.

Implements:
  - WM_ID = SHA256(K || H(X) || t)          — watermark identity
  - σ    = HMAC_SHA256(X_w, K)              — authentication signature
  - fingerprint = SHA256(X_w)               — content integrity hash
"""

import hashlib
import hmac
import os
from typing import Optional


# ── Secret key ───────────────────────────────────────────────────────────────
# In production: load from environment / secrets manager.
_DEFAULT_KEY = os.environ.get(
    "WATERMARK_SECRET_KEY", "hackeurope-secret-key-2024"
).encode("utf-8")


def get_secret_key() -> bytes:
    """Return the active HMAC/PRNG secret key (bytes)."""
    return _DEFAULT_KEY


# ── Content hashing ───────────────────────────────────────────────────────────

def compute_content_hash(data: bytes) -> bytes:
    """
    H(X) = SHA256(data)

    Produces a 32-byte digest that identifies the *original* content before
    watermarking.  Used as input to generate_watermark_id().
    """
    return hashlib.sha256(data).digest()


# ── Watermark ID ─────────────────────────────────────────────────────────────

def generate_watermark_id(content_hash: bytes, timestamp: str, key: bytes) -> str:
    """
    WM_ID = SHA256(K || H(X) || t)

    Combines:
      K        — secret key    (binds ID to this deployment)
      H(X)     — original content hash  (binds ID to specific content)
      t        — ISO-8601 UTC timestamp  (ensures uniqueness across calls)

    Returns a 64-char lowercase hex digest.
    """
    combined = key + content_hash + timestamp.encode("utf-8")
    return hashlib.sha256(combined).hexdigest()


# ── HMAC signature ────────────────────────────────────────────────────────────

def compute_hmac_signature(data: bytes, key: bytes) -> str:
    """
    σ = HMAC-SHA256(X_w, K)

    Authenticates the *watermarked* content (X_w).  Any post-watermark
    modification will produce a different signature, enabling tamper detection.

    Returns a 64-char lowercase hex digest.
    """
    h = hmac.new(key, data, hashlib.sha256)
    return h.hexdigest()


def verify_hmac_signature(data: bytes, signature: str, key: bytes) -> bool:
    """
    Constant-time comparison of computed vs. stored HMAC signature.

    Uses hmac.compare_digest() to prevent timing-oracle attacks.
    """
    expected = compute_hmac_signature(data, key)
    return hmac.compare_digest(expected, signature)


# ── Fingerprint ───────────────────────────────────────────────────────────────

def compute_fingerprint(data: bytes) -> str:
    """
    SHA256 fingerprint of content for independent integrity checking.
    Stored alongside the HMAC signature; useful for deduplication lookups.
    """
    return hashlib.sha256(data).hexdigest()


# ── PRNG seed derivation ──────────────────────────────────────────────────────

def derive_prng_seed(key: bytes, salt: bytes = b"") -> int:
    """
    Derive a 32-bit integer seed for numpy.random.RandomState from (key, salt).

    The same (key, salt) pair always yields the same seed, making all
    pseudo-random masks deterministic and reproducible for verification.
    """
    digest = hashlib.sha256(key + salt).digest()
    # Use first 4 bytes; keep within numpy's 32-bit seed limit
    return int.from_bytes(digest[:4], "big") % (2**31)
