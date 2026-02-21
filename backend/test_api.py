"""
Manual integration test — hits the live server at http://localhost:8000.
Run:  python3 test_api.py
"""

import base64, io, wave, json, sys
import urllib.request, urllib.error
import numpy as np
from PIL import Image

BASE = "http://localhost:8000"


def post(path, payload):
    body = json.dumps(payload).encode()
    req  = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code, e.read().decode())
        sys.exit(1)


def make_wav_b64(freq=440, n=8192, sr=44100):
    t = np.linspace(0, n / sr, n, endpoint=False)
    s = (np.sin(2 * np.pi * freq * t) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2)
        wf.setframerate(sr); wf.writeframes(s.tobytes())
    return base64.b64encode(buf.getvalue()).decode()


def make_png_b64(size=64):
    arr = np.tile(np.arange(size, dtype=np.uint8), (size, 1))
    img = Image.fromarray(arr, "L").convert("RGB")
    buf = io.BytesIO(); img.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


# ── Test cases ────────────────────────────────────────────────────────────────

CASES = [
    {
        "label":     "TEXT",
        "data_type": "text",
        "data":      "The quick brown fox jumps over the lazy dog. "
                     "Watermarking is a technique to embed hidden information.",
    },
    {
        "label":     "IMAGE",
        "data_type": "image",
        "data":      make_png_b64(),
    },
    {
        "label":     "AUDIO (440 Hz sine)",
        "data_type": "audio",
        "data":      make_wav_b64(),
    },
]

print(f"\n{'─'*60}")
print(f"  Multi-Modal Watermarking API — live test against {BASE}")
print(f"{'─'*60}")

for case in CASES:
    label     = case.pop("label")
    data_type = case["data_type"]
    data      = case["data"]

    print(f"\n▶  {label}")

    # ── Watermark ─────────────────────────────────────────────────
    wm = post("/api/watermark", {
        "data_type":          data_type,
        "data":               data,
        "watermark_strength": 0.8,
        "model_name":         "claude-sonnet-4-6",
    })
    meta  = wm["watermark_metadata"]
    proof = wm["integrity_proof"]
    print(f"   WM_ID     : {meta['watermark_id'][:32]}...")
    print(f"   Method    : {meta['embedding_method']}")
    print(f"   Model     : {meta['model_name']}")
    print(f"   Signature : {meta['cryptographic_signature'][:32]}...")
    print(f"   Timestamp : {proof['timestamp']}")

    # ── Verify ────────────────────────────────────────────────────
    vr = post("/api/verify", {
        "data_type":  data_type,
        "data":       wm["watermarked_data"],
        "model_name": "claude-sonnet-4-6",
    })
    res = vr["verification_result"]
    fod = vr["forensic_details"]
    print(f"   ── Verification ──")
    print(f"   Detected   : {res['watermark_detected']}")
    print(f"   Confidence : {res['confidence_score']:.4f}")
    print(f"   Matched ID : {str(res['matched_watermark_id'])[:32]}...")
    print(f"   Model      : {res['model_name']}")
    print(f"   Sig valid  : {fod['signature_valid']}")
    print(f"   Tampered   : {fod['tamper_detected']}")
    print(f"   Stat score : {fod['statistical_score']}")

    ok = res["watermark_detected"] and fod["signature_valid"] and not fod["tamper_detected"]
    print(f"   Result     : {'✓ PASS' if ok else '✗ FAIL'}")

# ── Health ────────────────────────────────────────────────────────────────────
req = urllib.request.Request(BASE + "/health")
with urllib.request.urlopen(req) as resp:
    h = json.loads(resp.read())
print(f"\n/health → {h}")
print(f"\n{'─'*60}")
print("  Done.")
print(f"{'─'*60}\n")
