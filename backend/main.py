"""
Multi-Modal Watermarking REST API  —  stateless edition
=========================================================
POST /api/watermark  — embed a self-authenticating watermark
POST /api/verify     — verify without any stored state

Key design change
-----------------
No in-memory registry or database is used.  All metadata (model_name,
timestamp, HMAC auth-tag) is embedded *inside* the watermarked content
itself as an invisible steganographic payload.  Verification reconstructs
everything directly from the received data + secret key K.

Cryptographic payload (26 bytes embedded per request)
------------------------------------------------------
  [0:2]   magic "WM"
  [2:6]   unix timestamp  uint32
  [6:22]  model_name      UTF-8, 16 bytes zero-padded
  [22:26] HMAC-SHA256(bytes[0:22], K)[:4]  — 32-bit auth tag

  WM_ID  = SHA256(K || ts_bytes || model_bytes)   — same formula both sides
"""

import base64
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from watermarking.crypto_utils import (
    compute_content_hash,
    compute_fingerprint,
    compute_hmac_signature,
    get_secret_key,
)
from watermarking.text_watermark  import embed_text_watermark,  verify_text_watermark
from watermarking.image_watermark import embed_image_watermark, verify_image_watermark
from watermarking.audio_watermark import embed_audio_watermark, verify_audio_watermark
from watermarking.payload import build_payload, derive_wm_id


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Multi-Modal Watermarking API  (stateless)",
    description=(
        "Embed and verify watermarks with ZERO server-side storage. "
        "All authentication metadata is carried inside the watermarked content."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class WatermarkRequest(BaseModel):
    data_type:          Literal["text", "image", "audio"]
    data:               str   = Field(..., description="UTF-8 text or base64-encoded binary")
    watermark_strength: float = Field(default=0.8, ge=0.0, le=1.0)
    model_name:         Optional[str] = Field(default=None,
                                              description="AI model that produced this content")


class VerifyRequest(BaseModel):
    data_type:  Literal["text", "image", "audio"]
    data:       str = Field(..., description="UTF-8 text or base64-encoded binary")
    model_name: Optional[str] = Field(default=None, description="Optional hint (not required)")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _raw_bytes(data_type: str, data: str) -> bytes:
    return data.encode("utf-8") if data_type == "text" else base64.b64decode(data)


def _dispatch_embed(req: WatermarkRequest, key: bytes, timestamp: str):
    """Route to the correct modality embedder, passing model_name + timestamp."""
    s = req.watermark_strength

    if req.data_type == "text":
        wm_data, meta = embed_text_watermark(
            req.data, key, strength=s,
            model_name=req.model_name, timestamp=timestamp,
        )
        raw    = wm_data.encode("utf-8")
        method = "kgw_statistical_payload_steganography"

    elif req.data_type == "image":
        wm_data, meta = embed_image_watermark(
            req.data, key, alpha=s * 10.0,
            model_name=req.model_name, timestamp=timestamp,
        )
        raw    = base64.b64decode(wm_data)
        method = "dct_lsb_dual_layer"

    elif req.data_type == "audio":
        wm_data, meta = embed_audio_watermark(
            req.data, key, alpha=s * 0.01,
            model_name=req.model_name, timestamp=timestamp,
        )
        raw    = base64.b64decode(wm_data)
        method = "fft_lsb_dual_layer"

    else:
        raise ValueError(f"Unsupported data_type: {req.data_type}")

    return wm_data, meta, raw, method


def _dispatch_verify(req: VerifyRequest, key: bytes):
    """Route to the correct modality verifier."""
    if req.data_type == "text":
        result = verify_text_watermark(req.data, key)
        raw    = req.data.encode("utf-8")
        score  = result.get("z_score", 0.0)

    elif req.data_type == "image":
        result = verify_image_watermark(req.data, key)
        raw    = base64.b64decode(req.data)
        score  = result.get("correlation", 0.0)

    elif req.data_type == "audio":
        result = verify_audio_watermark(req.data, key)
        raw    = base64.b64decode(req.data)
        score  = result.get("correlation", 0.0)

    else:
        raise ValueError(f"Unsupported data_type: {req.data_type}")

    return result, raw, float(score)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/watermark")
async def watermark_endpoint(req: WatermarkRequest):
    """
    Embed a self-authenticating watermark.

    The 26-byte signed payload (model_name + timestamp + HMAC tag) is
    embedded invisibly inside the content.  No server-side state is written.

    WM_ID  = SHA256(K || ts_bytes || model_bytes)
    σ      = HMAC-SHA256(watermarked_bytes, K)   — over full content
    """
    try:
        KEY       = get_secret_key()
        timestamp = _utc_now()

        # Embed (payload baked in)
        wm_data, embed_meta, wm_bytes, method = _dispatch_embed(req, KEY, timestamp)

        # Outer HMAC over the complete watermarked blob (for fingerprint only)
        signature   = compute_hmac_signature(wm_bytes, KEY)
        fingerprint = compute_fingerprint(wm_bytes)

        # Derive WM_ID — same formula used by /api/verify
        from watermarking.payload import build_payload, derive_wm_id
        import struct, time
        try:
            ts_unix = int(datetime.fromisoformat(timestamp).timestamp()) & 0xFFFF_FFFF
        except Exception:
            ts_unix = int(time.time()) & 0xFFFF_FFFF
        wm_id = derive_wm_id(req.model_name, ts_unix, KEY)

        return {
            "watermarked_data": wm_data,
            "watermark_metadata": {
                "watermark_id":            wm_id,
                "embedding_method":        method,
                "cryptographic_signature": signature,
                "fingerprint_hash":        fingerprint,
                "model_name":              req.model_name,
            },
            "integrity_proof": {
                "algorithm": "HMAC-SHA256",
                "timestamp": timestamp,
            },
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Watermarking failed: {exc}") from exc


@app.post("/api/verify")
async def verify_endpoint(req: VerifyRequest):
    """
    Verify a watermark — completely stateless, no registry needed.

    How it works
    ------------
    1. Run modality-specific statistical test (Z-score / DCT ρ / FFT ρ)
    2. Extract the embedded 26-byte payload from the content itself
    3. Validate the payload's HMAC tag using key K
    4. If valid: decode model_name + timestamp, reconstruct wm_id

    No prior state is required.  The data carries its own proof.
    """
    try:
        KEY                = get_secret_key()
        analysis_timestamp = _utc_now()

        stat_result, raw_bytes, stat_score = _dispatch_verify(req, KEY)

        # All cryptographic info comes FROM the data itself
        sig_valid  = stat_result.get("signature_valid", False)
        model_name = stat_result.get("model_name") or req.model_name
        ts_unix    = stat_result.get("timestamp_unix")
        wm_id      = stat_result.get("wm_id")

        watermark_detected = stat_result["detected"]
        confidence         = stat_result["confidence"]

        # Tamper: statistical signal present but embedded HMAC doesn't verify
        tamper_detected = watermark_detected and not sig_valid

        return {
            "verification_result": {
                "watermark_detected":   watermark_detected,
                "confidence_score":     round(float(confidence), 4),
                "matched_watermark_id": wm_id,
                "model_name":           model_name,
            },
            "forensic_details": {
                "signature_valid":   sig_valid,
                "tamper_detected":   tamper_detected,
                "statistical_score": round(float(stat_score), 6),
            },
            "analysis_timestamp": analysis_timestamp,
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Verification failed: {exc}") from exc


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "mode": "stateless", "registry": "none"}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
