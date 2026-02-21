#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  curl_test.sh  —  end-to-end curl tests for the Watermarking API
#  Usage:  bash curl_test.sh
#  Requires: curl, python3, jq (optional — falls back to python3 for pretty-print)
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:8000"
MODEL="claude-sonnet-4-6"

# Pretty-print JSON (use jq if available, else python3)
pretty() {
  if command -v jq &>/dev/null; then
    jq .
  else
    python3 -m json.tool
  fi
}

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Watermarking API  —  curl test suite"
echo "  Target: $BASE"
echo "══════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
# 0. Health check
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── GET /health ──────────────────────────────────────────────"
curl -s "$BASE/health" | pretty

# ─────────────────────────────────────────────────────────────────────────────
# 1. TEXT
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  MODALITY: TEXT"
echo "══════════════════════════════════════════════════════════════"

echo ""
echo "── POST /api/watermark (text) ───────────────────────────────"
WM_TEXT_RESPONSE=$(curl -s -X POST "$BASE/api/watermark" \
  -H "Content-Type: application/json" \
  -d "{
    \"data_type\": \"text\",
    \"data\": \"The quick brown fox jumps over the lazy dog. AI-generated content should be traceable.\",
    \"watermark_strength\": 0.8,
    \"model_name\": \"$MODEL\"
  }")
echo "$WM_TEXT_RESPONSE" | pretty

# Extract watermarked data for verify step
WM_TEXT_DATA=$(echo "$WM_TEXT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['watermarked_data'])")

echo ""
echo "── POST /api/verify (text) ──────────────────────────────────"
WM_TEXT_DATA_JSON=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$WM_TEXT_DATA")
curl -s -X POST "$BASE/api/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"data_type\": \"text\",
    \"data\": $WM_TEXT_DATA_JSON,
    \"model_name\": \"$MODEL\"
  }" | pretty

# ─────────────────────────────────────────────────────────────────────────────
# 2. IMAGE  (generate a 64×64 gradient PNG on the fly)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  MODALITY: IMAGE"
echo "══════════════════════════════════════════════════════════════"

IMG_B64=$(python3 - <<'PYEOF'
import base64, io
from PIL import Image
import numpy as np
arr = np.tile(np.arange(64, dtype=np.uint8), (64, 1))
img = Image.fromarray(arr, "L").convert("RGB")
buf = io.BytesIO()
img.save(buf, format="PNG")
print(base64.b64encode(buf.getvalue()).decode())
PYEOF
)

echo ""
echo "── POST /api/watermark (image) ──────────────────────────────"
WM_IMG_RESPONSE=$(curl -s -X POST "$BASE/api/watermark" \
  -H "Content-Type: application/json" \
  -d "{
    \"data_type\": \"image\",
    \"data\": \"$IMG_B64\",
    \"watermark_strength\": 0.8,
    \"model_name\": \"$MODEL\"
  }")
echo "$WM_IMG_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
# Truncate base64 blobs for readability
d['watermarked_data'] = d['watermarked_data'][:40] + '...[base64 truncated]'
print(json.dumps(d, indent=2))
"

WM_IMG_DATA=$(echo "$WM_IMG_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['watermarked_data'])")

echo ""
echo "── POST /api/verify (image) ─────────────────────────────────"
WM_IMG_DATA_JSON=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$WM_IMG_DATA")
curl -s -X POST "$BASE/api/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"data_type\": \"image\",
    \"data\": $WM_IMG_DATA_JSON,
    \"model_name\": \"$MODEL\"
  }" | pretty

# ─────────────────────────────────────────────────────────────────────────────
# 3. AUDIO  (generate a 440 Hz sine WAV on the fly)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  MODALITY: AUDIO"
echo "══════════════════════════════════════════════════════════════"

AUDIO_B64=$(python3 - <<'PYEOF'
import base64, io, wave
import numpy as np
n, sr = 8192, 44100
t = np.linspace(0, n/sr, n, endpoint=False)
s = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
buf = io.BytesIO()
with wave.open(buf, "wb") as wf:
    wf.setnchannels(1); wf.setsampwidth(2)
    wf.setframerate(sr); wf.writeframes(s.tobytes())
print(base64.b64encode(buf.getvalue()).decode())
PYEOF
)

echo ""
echo "── POST /api/watermark (audio) ──────────────────────────────"
WM_AUD_RESPONSE=$(curl -s -X POST "$BASE/api/watermark" \
  -H "Content-Type: application/json" \
  -d "{
    \"data_type\": \"audio\",
    \"data\": \"$AUDIO_B64\",
    \"watermark_strength\": 0.8,
    \"model_name\": \"$MODEL\"
  }")
echo "$WM_AUD_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['watermarked_data'] = d['watermarked_data'][:40] + '...[base64 truncated]'
print(json.dumps(d, indent=2))
"

WM_AUD_DATA=$(echo "$WM_AUD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['watermarked_data'])")

echo ""
echo "── POST /api/verify (audio) ─────────────────────────────────"
WM_AUD_DATA_JSON=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$WM_AUD_DATA")
curl -s -X POST "$BASE/api/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"data_type\": \"audio\",
    \"data\": $WM_AUD_DATA_JSON,
    \"model_name\": \"$MODEL\"
  }" | pretty

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Done."
echo "══════════════════════════════════════════════════════════════"
echo ""
