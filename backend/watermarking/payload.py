"""
Self-contained signed watermark payload.

Design goal
-----------
Embed authentication metadata INSIDE the watermarked content so that
verification needs zero external storage — just the data, its data_type,
and the secret key K.

Payload layout  (34 bytes = 272 bits)
--------------------------------------
  [0:2]   magic      b'\x57\x4d'  ("WM")  — identifies our payload format
  [2:6]   timestamp  unix uint32 big-endian
  [6:22]  model_name UTF-8, zero-padded to 16 bytes (truncated if longer)
  [22:30] context    UTF-8, zero-padded to 8 bytes (context of data, e.g. "Tıp")
  [30:34] auth_tag   HMAC-SHA256(bytes[0:30], K)[:4]  — 32-bit integrity tag

The 32-bit tag is a practical trade-off between payload size and security
for a hackathon setting.  Production would use the full 256-bit digest.

Bit encoding for text steganography (2 bits per word)
------------------------------------------------------
4 invisible Unicode characters cover all 2-bit combinations:
  (0,0) → U+200B  Zero-Width Space
  (0,1) → U+200C  Zero-Width Non-Joiner
  (1,0) → U+200D  Zero-Width Joiner
  (1,1) → U+2060  Word Joiner
Minimum text length for full payload: 208 / 2 = 104 words.
"""

import hashlib
import hmac as _hmac
import struct
import time
from datetime import datetime, timezone
from typing import Optional, Dict, List

# ── Constants ─────────────────────────────────────────────────────────────────
# ── Constants ─────────────────────────────────────────────────────────────────
MAGIC         = b"\x57\x4d"   # "WM"
_MODEL_LEN    = 16                  # bytes reserved for model_name
_CTX_LEN      = 8                   # bytes reserved for context
PAYLOAD_BYTES = 2 + 4 + _MODEL_LEN + _CTX_LEN + 4   # magic + ts + model + ctx + tag = 34
PAYLOAD_BITS  = PAYLOAD_BYTES * 8         # 272

# 2-bit → invisible Unicode character
ZW_ENC: Dict[tuple, str] = {
    (0, 0): "\u200b",   # Zero-Width Space
    (0, 1): "\u200c",   # Zero-Width Non-Joiner
    (1, 0): "\u200d",   # Zero-Width Joiner
    (1, 1): "\u2060",   # Word Joiner
}
ZW_DEC: Dict[str, tuple] = {v: k for k, v in ZW_ENC.items()}
ZW_SET: set = set(ZW_ENC.values())

WORDS_NEEDED = PAYLOAD_BITS // 2   # 120 words for full payload


# ── Payload build / parse ─────────────────────────────────────────────────────

def build_payload(
    model_name: Optional[str],
    timestamp: str,
    key: bytes,
    context: Optional[str] = None
) -> bytes:
    """
    Construct a 34-byte self-authenticating payload.

    Fields
    ------
    model_name : AI model identifier (truncated to 16 UTF-8 bytes)
    timestamp  : ISO-8601 UTC string from the watermark request
    key        : HMAC secret
    context    : Context category e.g. "Tıp", "Hukuk" (truncated to 8 UTF-8 bytes)

    Returns 34 raw bytes ready to be converted to bits and embedded.
    """
    # Parse timestamp → unix uint32
    try:
        ts_int = int(datetime.fromisoformat(timestamp).timestamp()) & 0xFFFF_FFFF
    except Exception:
        ts_int = int(time.time()) & 0xFFFF_FFFF

    model_b  = (model_name or "").encode("utf-8")[:_MODEL_LEN].ljust(_MODEL_LEN, b"\x00")
    ctx_b    = (context or "").encode("utf-8")[:_CTX_LEN].ljust(_CTX_LEN, b"\x00")
    pre_auth = MAGIC + struct.pack(">I", ts_int) + model_b + ctx_b           # 2+4+_MODEL_LEN+_CTX_LEN bytes
    tag      = _hmac.new(key, pre_auth, hashlib.sha256).digest()[:4] # 4 bytes
    return pre_auth + tag                                             # PAYLOAD_BYTES total


def parse_payload(raw: bytes, key: bytes) -> Optional[Dict]:
    """
    Authenticate and decode a 34-byte payload.

    Returns
    -------
    dict  {'model_name': str|None, 'timestamp_unix': int, 'context': str|None, 'valid': True}
          if magic header and HMAC tag are both valid.
    None  if either check fails (corrupted / foreign watermark / wrong key).
    """
    if len(raw) < PAYLOAD_BYTES:
        return None

    pl = raw[:PAYLOAD_BYTES]

    if pl[:2] != MAGIC:
        return None

    _pre_len     = 2 + 4 + _MODEL_LEN + _CTX_LEN         # magic + ts + model + ctx
    pre_auth     = pl[:_pre_len]
    claimed_tag  = pl[_pre_len:_pre_len + 4]
    expected_tag = _hmac.new(key, pre_auth, hashlib.sha256).digest()[:4]

    if not _hmac.compare_digest(claimed_tag, expected_tag):
        return None

    ts_int     = struct.unpack(">I", pl[2:6])[0]
    model_name = pl[6:6 + _MODEL_LEN].rstrip(b"\x00").decode("utf-8", errors="replace") or None
    context_str = pl[6 + _MODEL_LEN : 6 + _MODEL_LEN + _CTX_LEN].rstrip(b"\x00").decode("utf-8", errors="replace") or None

    return {"model_name": model_name, "timestamp_unix": ts_int, "context": context_str, "valid": True}


# ── Bit conversion helpers ────────────────────────────────────────────────────

def to_bits(data: bytes) -> List[int]:
    """bytes → [int, …] (MSB first)."""
    return [(b >> i) & 1 for b in data for i in range(7, -1, -1)]


def from_bits(bits) -> bytes:
    """[int, …] (MSB first) → bytes; pads with 0 to next multiple of 8."""
    bits = list(bits)
    while len(bits) % 8:
        bits.append(0)
    return bytes(
        sum(bits[i + j] << (7 - j) for j in range(8))
        for i in range(0, len(bits), 8)
    )


# ── WM-ID derivation (stateless, deterministic) ───────────────────────────────

def derive_wm_id(model_name: Optional[str], timestamp_unix: int, key: bytes) -> str:
    """
    Reconstruct the watermark ID purely from payload fields + key.

    WM_ID = SHA256(K || ts_bytes || model_bytes)

    Because this formula is used identically at embed time and at verify time,
    /api/verify returns the same ID that /api/watermark originally returned —
    without any registry lookup.
    """
    ts_b    = struct.pack(">I", timestamp_unix & 0xFFFF_FFFF)
    model_b = (model_name or "").encode("utf-8")[:_MODEL_LEN].ljust(_MODEL_LEN, b"\x00")
    return hashlib.sha256(key + ts_b + model_b).hexdigest()
