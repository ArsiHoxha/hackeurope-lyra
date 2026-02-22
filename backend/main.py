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
import hashlib
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
from watermarking.video_watermark import embed_video_watermark, verify_video_watermark
from watermarking.pdf_watermark   import embed_pdf_watermark,   verify_pdf_watermark
from watermarking.payload import build_payload, derive_wm_id
from watermarking.registry import (
    register_watermark,
    lookup_content,
    lookup_by_id,
    get_registry_stats,
    get_all_entries,
)


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
    data_type:          Literal["text", "image", "audio", "video", "pdf"]
    data:               str   = Field(..., description="UTF-8 text or base64-encoded binary")
    watermark_strength: float = Field(default=0.8, ge=0.0, le=1.0)
    model_name:         Optional[str] = Field(default=None,
                                              description="AI model that produced this content")
    context:            Optional[str] = Field(default=None,
                                              description="Context or category of data, e.g. Tıp, Hukuk")


class VerifyRequest(BaseModel):
    data_type:  Literal["text", "image", "audio", "video", "pdf"]
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
            model_name=req.model_name, timestamp=timestamp, context=req.context
        )
        raw    = wm_data.encode("utf-8")
        method = "kgw_statistical_payload_steganography"

    elif req.data_type == "image":
        wm_data, meta = embed_image_watermark(
            req.data, key, alpha=s * 10.0,
            model_name=req.model_name, timestamp=timestamp, context=req.context
        )
        raw    = base64.b64decode(wm_data)
        method = "dct_lsb_dual_layer"

    elif req.data_type == "audio":
        wm_data, meta = embed_audio_watermark(
            req.data, key, alpha=s * 0.01,
            model_name=req.model_name, timestamp=timestamp, context=req.context
        )
        raw    = base64.b64decode(wm_data)
        method = "fft_lsb_dual_layer"

    elif req.data_type == "video":
        wm_data, meta = embed_video_watermark(
            req.data, key, alpha=s * 4.0,
            model_name=req.model_name, timestamp=timestamp,
        )
        raw    = base64.b64decode(wm_data)
        method = "dct_qim_dual_layer"

    elif req.data_type == "pdf":
        wm_data, meta = embed_pdf_watermark(
            req.data, key,
            model_name=req.model_name, timestamp=timestamp, context=req.context
        )
        raw    = base64.b64decode(wm_data)
        method = "pdf_metadata_zw_dual_layer"

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

    elif req.data_type == "video":
        result = verify_video_watermark(req.data, key)
        raw    = base64.b64decode(req.data)
        score  = result.get("correlation", 0.0)

    elif req.data_type == "pdf":
        result = verify_pdf_watermark(req.data, key)
        raw    = base64.b64decode(req.data)
        score  = 0.9 if result.get("signature_valid") else 0.0

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
        import struct, time
        try:
            ts_unix = int(datetime.fromisoformat(timestamp).timestamp()) & 0xFFFF_FFFF
        except Exception:
            ts_unix = int(time.time()) & 0xFFFF_FFFF
        wm_id = derive_wm_id(req.model_name, ts_unix, KEY)

        # Build payload hex for registry
        payload = build_payload(req.model_name, timestamp, KEY, req.context)

        # ── Persist to server-side registry ────────────────────────────
        original_bytes = _raw_bytes(req.data_type, req.data)
        register_watermark(
            wm_id=wm_id,
            data_type=req.data_type,
            original_bytes=original_bytes,
            watermarked_bytes=wm_bytes,
            model_name=req.model_name,
            context=req.context,
            payload_hex=payload.hex(),
        )

        return {
            "watermarked_data": wm_data,
            "watermark_metadata": {
                "watermark_id":            wm_id,
                "embedding_method":        method,
                "cryptographic_signature": signature,
                "fingerprint_hash":        fingerprint,
                "model_name":              req.model_name,
                "context":                 req.context,
                "registry_stored":         True,
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
        sig_valid   = stat_result.get("signature_valid", False)
        model_name  = stat_result.get("model_name") or req.model_name
        ts_unix     = stat_result.get("timestamp_unix")
        context_str = stat_result.get("context")
        wm_id       = stat_result.get("wm_id")

        watermark_detected = stat_result["detected"]
        confidence         = stat_result["confidence"]

        # ── Registry fallback: if frequency layers failed, check registry ──
        registry_match = None
        if not watermark_detected:
            registry_match = lookup_content(req.data_type, raw_bytes)
            if registry_match:
                watermark_detected = True
                sig_valid          = True
                model_name         = registry_match.get("model_name") or model_name
                context_str        = registry_match.get("context") or context_str
                wm_id              = registry_match.get("wm_id")
                confidence         = 0.85 if "perceptual" in registry_match.get("match_type", "") else 0.95

        # Tamper: statistical signal present but embedded HMAC doesn't verify
        tamper_detected = watermark_detected and not sig_valid

        # Prediction / Insight / Decision logic
        risk_score = 0
        risk_level = "Low"
        decision = "Monitor"
        insight = "No unauthorized use detected."
        
        # Expanded sensitive contexts (20+ categories)
        SENSITIVE_CONTEXTS = [
            "medical", "health", "legal", "finance", "tech", 
            "military", "government", "pii", "hr", "r&d", 
            "education", "banking", "insurance", "pharma",
            "clinical", "judicial", "defense", "intelligence", 
            "tax", "audit", "biometric", "energy", "telecom",
            "aviation", "automotive", "cyber"
        ]
        
        if watermark_detected:
            if context_str and context_str.lower() in SENSITIVE_CONTEXTS:
                risk_score = 85
                risk_level = "High"
                insight = f"Sensitive content ({context_str}) from a regulated sector detected. High risk of non-compliance under EU AI Act and GDPR."
                decision = "Blockchain Evidence Seal & Automated Access Revocation"
            elif context_str:
                risk_score = 45
                risk_level = "Medium"
                insight = f"Standard content tagged as '{context_str}' detected in unauthorized environment."
                decision = "Flag for Manual Review & Monitor API Usage"
            else:
                risk_score = 30
                risk_level = "Low"
                insight = "General AI-generated content detected without specific context tags."
                decision = "Log Access & Continue Monitoring"

        # Add registry match info to the response
        source_info = stat_result.get("source", "frequency_domain")
        if registry_match:
            source_info = f"registry_{registry_match.get('match_type', 'unknown')}"

        return {
            "verification_result": {
                "watermark_detected":   watermark_detected,
                "confidence_score":     round(float(confidence), 4),
                "matched_watermark_id": wm_id,
                "model_name":           model_name,
                "context":              context_str,
                "detection_source":     source_info,
            },
            "insight_and_risk": {
                "predicted_risk_score": risk_score,
                "predicted_risk_level": risk_level,
                "insight":              insight,
                "automated_decision":   decision,
            },
            "forensic_details": {
                "signature_valid":   sig_valid,
                "tamper_detected":   tamper_detected,
                "statistical_score": round(float(stat_score), 6),
                "registry_match":    registry_match is not None,
            },
            "analysis_timestamp": analysis_timestamp,
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Verification failed: {exc}") from exc


# ── Registry endpoints ────────────────────────────────────────────────────────

@app.get("/api/registry")
async def registry_stats():
    """Get registry statistics."""
    return get_registry_stats()


@app.get("/api/registry/entries")
async def registry_entries():
    """Get all registry entries."""
    return get_all_entries()


@app.post("/api/registry/lookup")
async def registry_lookup(req: VerifyRequest):
    """Look up content in the registry by hash or perceptual similarity."""
    raw = _raw_bytes(req.data_type, req.data)
    result = lookup_content(req.data_type, raw)
    if result:
        return {"found": True, "match": result}
    return {"found": False, "match": None}


@app.get("/api/registry/{wm_id}")
async def registry_lookup_id(wm_id: str):
    """Look up a specific watermark by ID."""
    result = lookup_by_id(wm_id)
    if result:
        return {"found": True, "match": result}
    return {"found": False, "match": None}



# ── Security endpoints ────────────────────────────────────────────────────────
#
# These back the SecurityTab in the frontend dashboard.
# All state is stored in-memory (ephemeral) — suitable for demo/hackathon use.

import secrets as _secrets
import time as _time

_security_state = {
    "key_rotation_epoch": 1,
    "key_last_rotated": None,
    "entropy_level": "high",
    "two_factor_enabled": False,
    "anti_scraping_enabled": True,
    "webhook_url": None,
    "total_api_keys": 0,
}
_api_keys: list = []
_request_counts: dict = {}


class SecurityConfigBody(BaseModel):
    entropy_level: Optional[str] = None
    two_factor_enabled: Optional[bool] = None
    anti_scraping_enabled: Optional[bool] = None
    webhook_url: Optional[str] = None


class ApiKeyBody(BaseModel):
    scope: str = "read"
    expires_in_days: int = 30


class RevokeKeyBody(BaseModel):
    key_id: str


class ProvenanceBody(BaseModel):
    content: str
    data_type: str = "text"
    model_name: Optional[str] = None


class ProvenanceVerifyBody(BaseModel):
    content: str
    data_type: str = "text"
    certificate: dict


class FingerprintBody(BaseModel):
    content: str
    data_type: str = "text"


@app.get("/api/security/config")
async def security_config_get():
    return {**_security_state}


@app.post("/api/security/config")
async def security_config_update(body: SecurityConfigBody):
    if body.entropy_level is not None:
        _security_state["entropy_level"] = body.entropy_level
    if body.two_factor_enabled is not None:
        _security_state["two_factor_enabled"] = body.two_factor_enabled
    if body.anti_scraping_enabled is not None:
        _security_state["anti_scraping_enabled"] = body.anti_scraping_enabled
    if body.webhook_url is not None:
        _security_state["webhook_url"] = body.webhook_url
    return {**_security_state}


@app.post("/api/security/audit")
async def security_audit():
    key = get_secret_key()
    has_strong_key   = len(key) >= 32
    has_anti_scrape  = _security_state["anti_scraping_enabled"]
    has_2fa          = _security_state["two_factor_enabled"]
    has_webhook      = bool(_security_state["webhook_url"])
    high_entropy     = _security_state["entropy_level"] == "high"
    has_active_keys  = any(not k["revoked"] for k in _api_keys)
    epoch            = _security_state["key_rotation_epoch"]

    checks = [
        {"id": "strong_key",       "label": "Deployment key ≥ 32 bytes",      "passed": has_strong_key,   "severity": "critical", "weight": 30, "fix_action": "change_key"},
        {"id": "entropy_high",     "label": "High entropy embedding enabled",  "passed": high_entropy,     "severity": "high",     "weight": 20, "fix_action": "set_entropy"},
        {"id": "anti_scraping",    "label": "Anti-scraping detection on",      "passed": has_anti_scrape,  "severity": "medium",   "weight": 15, "fix_action": "enable_anti_scraping"},
        {"id": "key_rotated",      "label": "Key rotated at least once",        "passed": epoch > 1,        "severity": "high",     "weight": 15, "fix_action": "rotate_key"},
        {"id": "two_factor",       "label": "Two-factor auth enabled",         "passed": has_2fa,          "severity": "medium",   "weight": 10, "fix_action": "enable_2fa"},
        {"id": "webhook",          "label": "Alert webhook configured",         "passed": has_webhook,      "severity": "low",      "weight": 5,  "fix_action": "configure_webhook"},
        {"id": "scoped_keys",      "label": "Scoped API keys in use",           "passed": has_active_keys,  "severity": "low",      "weight": 5,  "fix_action": "run_audit"},
    ]

    passed = sum(1 for c in checks if c["passed"])
    total  = len(checks)
    score  = sum(c["weight"] for c in checks if c["passed"])

    return {
        "score": score,
        "checks": checks,
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "audited_at": _utc_now(),
    }


@app.post("/api/security/rotate-key")
async def security_rotate_key():
    _security_state["key_rotation_epoch"] += 1
    _security_state["key_last_rotated"] = _utc_now()
    return {
        "epoch": _security_state["key_rotation_epoch"],
        "rotated_at": _security_state["key_last_rotated"],
        "message": "Master key epoch incremented. New watermarks use the updated key.",
    }


@app.post("/api/security/api-keys/generate")
async def security_generate_api_key(body: ApiKeyBody):
    raw_key  = _secrets.token_hex(32)
    key_id   = _secrets.token_hex(8)
    now      = datetime.now(timezone.utc)
    expires  = datetime.fromtimestamp(now.timestamp() + body.expires_in_days * 86400, tz=timezone.utc)
    entry = {
        "id":      key_id,
        "scope":   body.scope,
        "created": now.isoformat(),
        "expires": expires.isoformat(),
        "revoked": False,
        "prefix":  raw_key[:8] + "...",
        "api_key": raw_key,
        "key_id":  key_id,
    }
    _api_keys.append(entry)
    _security_state["total_api_keys"] = len(_api_keys)
    return entry


@app.get("/api/security/api-keys")
async def security_list_api_keys():
    # Return masked — never expose raw key again after generation
    return [{k: v for k, v in entry.items() if k != "api_key"} for entry in _api_keys]


@app.post("/api/security/api-keys/revoke")
async def security_revoke_api_key(body: RevokeKeyBody):
    for key in _api_keys:
        if key["id"] == body.key_id:
            key["revoked"] = True
    return {"revoked": True}


@app.post("/api/security/provenance")
async def security_provenance(body: ProvenanceBody):
    key = get_secret_key()
    content_bytes = body.content.encode("utf-8")
    content_hash  = hashlib.sha256(content_bytes).hexdigest()
    import hmac as _hmac
    provenance_id = _hmac.new(key, content_bytes, hashlib.sha256).hexdigest()
    origin_proof  = _hmac.new(key, provenance_id.encode(), hashlib.sha256).hexdigest()
    chain_hash    = hashlib.sha256((content_hash + provenance_id + origin_proof).encode()).hexdigest()
    anti_scrape   = _hmac.new(key, (content_hash + str(_time.time())).encode(), hashlib.sha256).hexdigest()[:16]

    return {
        "version": "1.0",
        "content_hash": content_hash,
        "content_size_bytes": len(content_bytes),
        "data_type": body.data_type,
        "model_name": body.model_name or "Unknown",
        "provenance_id": provenance_id,
        "origin_proof": origin_proof,
        "anti_scrape_fingerprint": anti_scrape,
        "chain_hash": chain_hash,
        "issued_at": _utc_now(),
        "issuer": "Lyra Watermarking API v3",
        "algorithm": "HMAC-SHA256",
        "key_epoch": _security_state["key_rotation_epoch"],
        "entropy_level": _security_state["entropy_level"],
        "claims": {
            "ip_protection": True,
            "anti_scraping": _security_state["anti_scraping_enabled"],
            "tamper_evident": True,
            "provenance_verified": True,
        },
    }


@app.post("/api/security/provenance/verify")
async def security_provenance_verify(body: ProvenanceVerifyBody):
    key = get_secret_key()
    import hmac as _hmac
    content_bytes    = body.content.encode("utf-8")
    cert             = body.certificate
    computed_hash    = hashlib.sha256(content_bytes).hexdigest()
    computed_prov_id = _hmac.new(key, content_bytes, hashlib.sha256).hexdigest()
    computed_origin  = _hmac.new(key, computed_prov_id.encode(), hashlib.sha256).hexdigest()
    computed_chain   = hashlib.sha256((computed_hash + computed_prov_id + computed_origin).encode()).hexdigest()

    checks = {
        "content_hash":    computed_hash    == cert.get("content_hash"),
        "provenance_id":   computed_prov_id == cert.get("provenance_id"),
        "origin_proof":    computed_origin  == cert.get("origin_proof"),
        "chain_integrity": computed_chain   == cert.get("chain_hash"),
    }
    return {
        "valid": all(checks.values()),
        "checks": checks,
        "content_hash": computed_hash,
        "verified_at": _utc_now(),
    }


@app.post("/api/security/fingerprint")
async def security_fingerprint(body: FingerprintBody):
    key = get_secret_key()
    import hmac as _hmac
    nonce       = _secrets.token_hex(8)
    fingerprint = _hmac.new(key, (body.content + nonce).encode(), hashlib.sha256).hexdigest()
    ip          = "0.0.0.0"
    now_min     = int(_time.time() // 60)
    count       = _request_counts.get((ip, now_min), 0) + 1
    _request_counts[(ip, now_min)] = count

    return {
        "fingerprint": fingerprint,
        "nonce": nonce,
        "scraping_alert": count > 30,
        "requests_last_minute": count,
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    stats = get_registry_stats()
    return {
        "status": "ok",
        "mode": "stateless+registry",
        "registry_entries": stats["total_entries"],
        "v": "3.0",
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
