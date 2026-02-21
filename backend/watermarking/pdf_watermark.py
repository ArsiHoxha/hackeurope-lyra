"""
PDF watermarking — metadata payload + ZW annotation steganography.

Two independent layers
----------------------
Layer 1 – Metadata (primary, lossless):
  Embed the 30-byte HMAC-signed payload as a hex string in the PDF's
  custom document metadata field '/WM_PAYLOAD'.
  Survives any PDF-compliant save/load/linearise cycle without loss.

Layer 2 – Annotation steganography (secondary):
  Add a hidden FreeText annotation on page 1 containing the same payload
  encoded as zero-width Unicode characters (2 bits per char — identical
  encoding to the text watermarking module).
  Provides a second extraction path independent of document metadata,
  surviving metadata-stripping tools.

Verification checks Layer 1 first, falls back to Layer 2 if stripped.
Both checks are stateless — the PDF and key K are sufficient.
"""

import base64
from io import BytesIO
from typing import Tuple, Dict, Optional

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    DictionaryObject, NameObject, ArrayObject,
    FloatObject, NumberObject, create_string_object,
)

from watermarking.payload import (
    PAYLOAD_BITS,
    build_payload, parse_payload,
    to_bits, ZW_ENC, ZW_DEC,
    from_bits, derive_wm_id,
)

_META_KEY = "/WM_PAYLOAD"


# ── Internal helpers ──────────────────────────────────────────────────────────

def _bits_to_zw(bits: list) -> str:
    """Convert payload bits to zero-width Unicode string (2 bits per char)."""
    zw = ""
    for i in range(0, len(bits), 2):
        b0 = bits[i]
        b1 = bits[i + 1] if i + 1 < len(bits) else 0
        zw += ZW_ENC[(b0, b1)]
    return zw


def _zw_to_bits(text: str) -> list:
    """Extract payload bits from a string containing zero-width chars."""
    bits = []
    for ch in text:
        if ch in ZW_DEC:
            b0, b1 = ZW_DEC[ch]
            bits.extend([b0, b1])
    return bits


def _make_hidden_annot(zw_text: str) -> DictionaryObject:
    """
    Build a PDF FreeText annotation dict carrying invisible ZW chars.

    Flags 1+2 = Invisible + Hidden  →  never rendered by any viewer.
    DA string sets font size 0.01pt, white color  →  doubly invisible.
    Rect (0,0,0.1,0.1) at bottom-left corner  →  zero visual footprint.
    """
    annot = DictionaryObject()
    annot[NameObject("/Type")]     = NameObject("/Annot")
    annot[NameObject("/Subtype")]  = NameObject("/FreeText")
    annot[NameObject("/Rect")]     = ArrayObject([
        FloatObject(0), FloatObject(0), FloatObject(0.1), FloatObject(0.1)
    ])
    annot[NameObject("/Contents")] = create_string_object(zw_text)
    annot[NameObject("/F")]        = NumberObject(3)   # Invisible (1) + Hidden (2)
    annot[NameObject("/DA")]       = create_string_object("/Helv 0.01 Tf 1 1 1 rg")
    annot[NameObject("/BS")]       = DictionaryObject({
        NameObject("/W"): NumberObject(0)              # zero border width
    })
    return annot


# ── Public API ────────────────────────────────────────────────────────────────

def embed_pdf_watermark(
    pdf_b64:    str,
    key:        bytes,
    model_name: Optional[str] = None,
    timestamp:  str = "",
) -> Tuple[str, Dict]:
    """
    Embed a self-authenticating watermark into a PDF document.

    Process
    -------
    1. Decode base64 PDF → PdfReader
    2. Build 30-byte HMAC payload (model_name + timestamp + tag)
    3. Layer 1: write payload hex to custom '/WM_PAYLOAD' metadata field
    4. Layer 2: add hidden FreeText annotation on page 0 containing
                the payload encoded as zero-width Unicode characters
    5. Re-serialise and return as base64 PDF

    Returns (base64_pdf, metadata_dict)
    """
    pdf_bytes    = base64.b64decode(pdf_b64)
    reader       = PdfReader(BytesIO(pdf_bytes))
    writer       = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    payload      = build_payload(model_name, timestamp, key)
    payload_hex  = payload.hex()
    payload_bits = to_bits(payload)
    zw_text      = _bits_to_zw(payload_bits)

    # Layer 1: custom metadata
    writer.add_metadata({_META_KEY: payload_hex})

    # Layer 2: hidden annotation on first page
    if writer.pages:
        annot = _make_hidden_annot(zw_text)
        writer.add_annotation(page_number=0, annotation=annot)

    buf = BytesIO()
    writer.write(buf)
    out_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return out_b64, {
        "embedding_method": "pdf_metadata_zw_dual_layer",
        "n_pages":          len(reader.pages),
        "payload_bits":     PAYLOAD_BITS,
    }


def verify_pdf_watermark(
    pdf_b64: str,
    key:     bytes,
) -> Dict:
    """
    Stateless PDF watermark verification — no registry required.

    Process
    -------
    1. Check '/WM_PAYLOAD' metadata field → hex-decode → parse_payload()
    2. If metadata stripped: iterate FreeText annotations → extract ZW bits
       → parse_payload() → HMAC validates in-data
    3. Return result from whichever layer succeeds (or both failed)

    Returns dict with detected, confidence, signature_valid,
                      model_name, timestamp_unix, wm_id, source
    """
    pdf_bytes = base64.b64decode(pdf_b64)
    reader    = PdfReader(BytesIO(pdf_bytes))

    sig_valid  = False
    model_name = None
    ts_unix    = None
    wm_id      = None
    source     = None

    def _try(raw: bytes) -> bool:
        nonlocal sig_valid, model_name, ts_unix, wm_id
        p = parse_payload(raw, key)
        if p:
            sig_valid  = True
            model_name = p["model_name"]
            ts_unix    = p["timestamp_unix"]
            wm_id      = derive_wm_id(model_name, ts_unix, key)
            return True
        return False

    # ── Layer 1: metadata ─────────────────────────────────────────────────
    meta    = reader.metadata or {}
    hex_val = meta.get(_META_KEY)
    if hex_val:
        try:
            if _try(bytes.fromhex(str(hex_val))):
                source = "metadata"
        except Exception:
            pass

    # ── Layer 2: annotations (fallback if metadata stripped) ──────────────
    if not sig_valid:
        for page in reader.pages:
            if sig_valid:
                break
            annots = page.get("/Annots")
            if not annots:
                continue
            for ref in annots:
                try:
                    obj = ref.get_object()
                    if obj.get("/Subtype") != "/FreeText":
                        continue
                    contents = str(obj.get("/Contents", ""))
                    bits     = _zw_to_bits(contents)
                    if len(bits) >= PAYLOAD_BITS:
                        raw = from_bits(bits[:PAYLOAD_BITS])
                        if _try(raw):
                            source = "annotation"
                            break
                except Exception:
                    continue

    confidence = 0.9 if sig_valid else 0.0
    return {
        "detected":        sig_valid,
        "confidence":      confidence,
        "signature_valid": sig_valid,
        "model_name":      model_name,
        "timestamp_unix":  ts_unix,
        "wm_id":           wm_id,
        "source":          source,
    }
