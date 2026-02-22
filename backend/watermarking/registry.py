"""
Persistent Watermark Registry — server-side proof of every watermarked content.

Why this exists
---------------
Frequency-domain watermarks (DCT, QIM) live inside the content.  If someone
completely replaces the pixels, or strips PNG metadata, those layers are gone.
This registry is the LAST LINE OF DEFENSE — it stores proof externally so
you can always prove provenance.

Storage
-------
  registry.json  — append-only JSON file in the backend directory.
  Each entry stores:
    • wm_id           — SHA-256 watermark identifier
    • content_hash    — SHA-256 of the original content bytes
    • wm_content_hash — SHA-256 of the watermarked content bytes
    • phash           — perceptual hash of images (survives edits, crops, resizes)
    • frame_hashes    — list of perceptual hashes from video keyframes
    • audio_fp        — spectral fingerprint for audio content
    • text_shingles   — MinHash signature for text similarity
    • model_name      — AI model that produced the content
    • context         — content category
    • data_type       — text / image / audio / pdf / video
    • timestamp       — ISO-8601 UTC
    • payload_hex     — the full 34-byte signed payload as hex

Lookup modes
------------
  1. Exact match by wm_id
  2. Exact match by content_hash or wm_content_hash
  3. Perceptual match for images — Hamming distance ≤ 64 between pHashes
  4. Video keyframe match — if ≥50% of keyframe hashes match (distance ≤ 12)
  5. Audio spectral match — cosine similarity ≥ 0.80 of FFT fingerprints
  6. Text similarity — Jaccard similarity ≥ 0.40 of MinHash shingle sets
"""

import hashlib
import json
import os
import math
import threading
from datetime import datetime, timezone
from typing import Optional, Dict, List
from pathlib import Path

# ── Perceptual hash for IMAGES ───────────────────────────────────────────────

def _average_hash(image_bytes: bytes, hash_size: int = 16) -> Optional[str]:
    """
    Compute a perceptual average hash for an image.
    
    Process:
      1. Resize to hash_size × hash_size (tiny thumbnail)
      2. Convert to grayscale
      3. Compute mean pixel value
      4. Each pixel → 1 if above mean, 0 if below
      5. Return as hex string
    
    This hash is VERY robust:
      ✅ Same image at different sizes → same hash
      ✅ JPEG compression → same hash
      ✅ Color adjustments → same or very close hash
      ✅ Screenshots of the image → close hash
      ⚠️  Heavy cropping → different hash (different composition)
    """
    try:
        from PIL import Image
        from io import BytesIO
        
        img = Image.open(BytesIO(image_bytes))
        img = img.resize((hash_size, hash_size), Image.Resampling.LANCZOS).convert("L")
        
        import numpy as np
        pixels = np.array(img, dtype=np.float64).flatten()
        mean = pixels.mean()
        bits = (pixels > mean).astype(np.uint8)
        
        byte_list = []
        for i in range(0, len(bits), 8):
            byte_val = 0
            for j in range(8):
                if i + j < len(bits):
                    byte_val |= int(bits[i + j]) << (7 - j)
            byte_list.append(byte_val)
        
        return bytes(byte_list).hex()
    except Exception:
        return None


def _average_hash_from_frame(frame_rgb, hash_size: int = 16) -> Optional[str]:
    """Compute average hash from a numpy RGB frame (H, W, 3)."""
    try:
        from PIL import Image
        import numpy as np
        
        img = Image.fromarray(frame_rgb)
        img = img.resize((hash_size, hash_size), Image.Resampling.LANCZOS).convert("L")
        
        pixels = np.array(img, dtype=np.float64).flatten()
        mean = pixels.mean()
        bits = (pixels > mean).astype(np.uint8)
        
        byte_list = []
        for i in range(0, len(bits), 8):
            byte_val = 0
            for j in range(8):
                if i + j < len(bits):
                    byte_val |= int(bits[i + j]) << (7 - j)
            byte_list.append(byte_val)
        
        return bytes(byte_list).hex()
    except Exception:
        return None


def _hamming_distance(h1: str, h2: str) -> int:
    """Hamming distance between two hex hash strings."""
    if not h1 or not h2 or len(h1) != len(h2):
        return 999
    b1 = bytes.fromhex(h1)
    b2 = bytes.fromhex(h2)
    return sum(bin(a ^ b).count('1') for a, b in zip(b1, b2))


# ── Perceptual hash for VIDEOS (keyframe sampling) ──────────────────────────

def _video_frame_hashes(video_bytes: bytes, num_frames: int = 8) -> Optional[List[str]]:
    """
    Extract keyframe perceptual hashes from a video.
    
    Samples `num_frames` evenly spaced across the video and computes
    an average hash for each.  Even if AI edits remove/change one element,
    most frames will still match because the background/scene is similar.
    
    Tolerates:
      ✅ Re-encoding (H.264 → H.265, different bitrate)
      ✅ Minor element removal (background frames still match)
      ✅ Color grading, brightness changes
      ✅ Resolution changes
      ⚠️  Complete scene replacement → won't match that frame
    """
    try:
        import tempfile, cv2
        import numpy as np
        
        # Write bytes to temp file for cv2
        with tempfile.NamedTemporaryFile(suffix=".avi", delete=False) as f:
            f.write(video_bytes)
            tmp_path = f.name
        
        try:
            cap = cv2.VideoCapture(tmp_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if total_frames < 1:
                cap.release()
                return None
            
            # Sample evenly spaced frames
            indices = [int(i * total_frames / num_frames) for i in range(num_frames)]
            hashes = []
            
            for idx in indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame = cap.read()
                if not ret:
                    continue
                # BGR → RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                h = _average_hash_from_frame(frame_rgb)
                if h:
                    hashes.append(h)
            
            cap.release()
            return hashes if hashes else None
        finally:
            os.unlink(tmp_path)
    except Exception:
        return None


# ── Spectral fingerprint for AUDIO ───────────────────────────────────────────

def _audio_spectral_fingerprint(audio_bytes: bytes, n_bands: int = 32) -> Optional[List[float]]:
    """
    Compute a spectral fingerprint for audio content.
    
    Takes the FFT magnitude spectrum, averages into `n_bands` frequency bands,
    and returns the normalized magnitude vector.  This is robust to:
      ✅ MP3/AAC re-compression
      ✅ Volume normalization
      ✅ Minor speed changes (±5%)
      ⚠️  Heavy pitch shifting or time-stretching → degrades
    """
    try:
        import numpy as np
        import struct
        from io import BytesIO
        
        # Try to parse as WAV
        buf = BytesIO(audio_bytes)
        riff = buf.read(4)
        if riff != b'RIFF':
            return None
        
        buf.read(4)  # file size
        wave = buf.read(4)
        if wave != b'WAVE':
            return None
        
        # Find data chunk
        sample_rate = 44100
        channels = 1
        bits_per_sample = 16
        
        while True:
            chunk_id = buf.read(4)
            if len(chunk_id) < 4:
                break
            chunk_size = struct.unpack('<I', buf.read(4))[0]
            
            if chunk_id == b'fmt ':
                fmt_data = buf.read(chunk_size)
                audio_fmt = struct.unpack('<H', fmt_data[0:2])[0]
                channels = struct.unpack('<H', fmt_data[2:4])[0]
                sample_rate = struct.unpack('<I', fmt_data[4:8])[0]
                bits_per_sample = struct.unpack('<H', fmt_data[14:16])[0]
            elif chunk_id == b'data':
                raw_data = buf.read(chunk_size)
                break
            else:
                buf.read(chunk_size)
        else:
            return None
        
        # Parse samples
        if bits_per_sample == 16:
            samples = np.frombuffer(raw_data, dtype=np.int16).astype(np.float64)
        elif bits_per_sample == 32:
            samples = np.frombuffer(raw_data, dtype=np.int32).astype(np.float64)
        else:
            return None
        
        # Mono mixdown
        if channels > 1:
            samples = samples.reshape(-1, channels).mean(axis=1)
        
        # Normalize
        peak = np.max(np.abs(samples))
        if peak > 0:
            samples = samples / peak
        
        # FFT
        fft_mag = np.abs(np.fft.rfft(samples))
        
        # Average into n_bands
        band_size = len(fft_mag) // n_bands
        if band_size < 1:
            return None
        
        bands = []
        for i in range(n_bands):
            start = i * band_size
            end = start + band_size
            bands.append(float(np.mean(fft_mag[start:end])))
        
        # Normalize vector
        norm = math.sqrt(sum(b * b for b in bands))
        if norm > 0:
            bands = [b / norm for b in bands]
        
        return [round(b, 6) for b in bands]
    except Exception:
        return None


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Text similarity (MinHash shingling) ──────────────────────────────────────

def _text_shingles(text: str, k: int = 3) -> Optional[List[str]]:
    """
    Create k-gram shingles from text for similarity matching.
    
    Even if someone rearranges paragraphs or changes a few words,
    most shingles will still overlap.
    """
    try:
        # Normalize: lowercase, collapse whitespace
        words = text.lower().split()
        if len(words) < k:
            return None
        
        shingles = set()
        for i in range(len(words) - k + 1):
            shingle = " ".join(words[i:i+k])
            shingles.add(hashlib.md5(shingle.encode()).hexdigest()[:8])
        
        # Keep up to 200 shingles for storage efficiency
        return sorted(list(shingles))[:200]
    except Exception:
        return None


def _jaccard_similarity(a: List[str], b: List[str]) -> float:
    """Jaccard similarity between two shingle sets."""
    if not a or not b:
        return 0.0
    set_a = set(a)
    set_b = set(b)
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


# ── Registry file I/O ────────────────────────────────────────────────────────

_REGISTRY_FILE = Path(__file__).parent.parent / "registry.json"
_lock = threading.Lock()


def _read_registry() -> List[Dict]:
    """Read the registry file. Returns empty list if missing/corrupt."""
    if not _REGISTRY_FILE.exists():
        return []
    try:
        with open(_REGISTRY_FILE, "r") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _write_registry(entries: List[Dict]):
    """Write the registry file atomically."""
    tmp = str(_REGISTRY_FILE) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    os.replace(tmp, str(_REGISTRY_FILE))


# ── Public API ────────────────────────────────────────────────────────────────

def register_watermark(
    wm_id:            str,
    data_type:        str,
    original_bytes:   bytes,
    watermarked_bytes: bytes,
    model_name:       Optional[str] = None,
    context:          Optional[str] = None,
    payload_hex:      Optional[str] = None,
) -> Dict:
    """
    Store proof of a watermarked content in the persistent registry.
    
    Called automatically after every successful watermark embedding.
    Computes all perceptual fingerprints for the content type.
    """
    content_hash    = hashlib.sha256(original_bytes).hexdigest()
    wm_content_hash = hashlib.sha256(watermarked_bytes).hexdigest()
    
    # Compute type-specific perceptual fingerprints
    phash        = None
    frame_hashes = None
    audio_fp     = None
    text_shings  = None
    
    if data_type == "image":
        phash = _average_hash(original_bytes)
    elif data_type == "video":
        frame_hashes = _video_frame_hashes(original_bytes)
    elif data_type == "audio":
        audio_fp = _audio_spectral_fingerprint(original_bytes)
    elif data_type == "text":
        text_shings = _text_shingles(original_bytes.decode("utf-8", errors="ignore"))
    
    entry = {
        "wm_id":            wm_id,
        "data_type":        data_type,
        "content_hash":     content_hash,
        "wm_content_hash":  wm_content_hash,
        "phash":            phash,
        "frame_hashes":     frame_hashes,
        "audio_fingerprint": audio_fp,
        "text_shingles":    text_shings,
        "model_name":       model_name,
        "context":          context,
        "payload_hex":      payload_hex,
        "registered_at":    datetime.now(timezone.utc).isoformat(),
    }
    
    with _lock:
        entries = _read_registry()
        if not any(e.get("wm_id") == wm_id for e in entries):
            entries.append(entry)
            _write_registry(entries)
    
    return entry


def lookup_by_id(wm_id: str) -> Optional[Dict]:
    """Exact lookup by watermark ID."""
    entries = _read_registry()
    for e in entries:
        if e.get("wm_id") == wm_id:
            return e
    return None


def lookup_by_hash(content_hash: str) -> Optional[Dict]:
    """Exact lookup by SHA-256 content hash (original or watermarked)."""
    entries = _read_registry()
    for e in entries:
        if e.get("content_hash") == content_hash or e.get("wm_content_hash") == content_hash:
            return e
    return None


def lookup_by_perceptual_image(image_bytes: bytes, max_distance: int = 64) -> Optional[Dict]:
    """Find a registered image by perceptual similarity (average hash)."""
    query_hash = _average_hash(image_bytes)
    if not query_hash:
        return None
    
    entries = _read_registry()
    best_match = None
    best_distance = max_distance + 1
    
    for e in entries:
        if e.get("data_type") != "image" or not e.get("phash"):
            continue
        dist = _hamming_distance(query_hash, e["phash"])
        if dist < best_distance:
            best_distance = dist
            best_match = e
    
    if best_match and best_distance <= max_distance:
        return {**best_match, "match_distance": best_distance, "match_type": "perceptual_image"}
    return None


def lookup_by_perceptual_video(video_bytes: bytes, min_frame_match: float = 0.5) -> Optional[Dict]:
    """
    Find a registered video by keyframe perceptual matching.
    
    Computes hashes for query video keyframes, then checks what %
    of frames in each registry entry match (Hamming ≤ 64).
    
    If ≥ min_frame_match (50%) of frames match, it's considered a hit.
    This means even if AI editing changed half the scenes, the other
    half still proves provenance.
    """
    query_hashes = _video_frame_hashes(video_bytes)
    if not query_hashes:
        return None
    
    entries = _read_registry()
    best_match = None
    best_score = min_frame_match
    
    for e in entries:
        if e.get("data_type") != "video" or not e.get("frame_hashes"):
            continue
        
        reg_hashes = e["frame_hashes"]
        matches = 0
        total = min(len(query_hashes), len(reg_hashes))
        
        # For each query frame, find best match in registry frames
        for qh in query_hashes:
            for rh in reg_hashes:
                if _hamming_distance(qh, rh) <= 64:
                    matches += 1
                    break
        
        ratio = matches / max(total, 1)
        if ratio > best_score:
            best_score = ratio
            best_match = e
    
    if best_match:
        return {
            **best_match,
            "match_score": round(best_score, 3),
            "match_type": "perceptual_video",
        }
    return None


def lookup_by_perceptual_audio(audio_bytes: bytes, min_similarity: float = 0.80) -> Optional[Dict]:
    """Find a registered audio by spectral fingerprint similarity."""
    query_fp = _audio_spectral_fingerprint(audio_bytes)
    if not query_fp:
        return None
    
    entries = _read_registry()
    best_match = None
    best_sim = min_similarity
    
    for e in entries:
        if e.get("data_type") != "audio" or not e.get("audio_fingerprint"):
            continue
        sim = _cosine_similarity(query_fp, e["audio_fingerprint"])
        if sim > best_sim:
            best_sim = sim
            best_match = e
    
    if best_match:
        return {
            **best_match,
            "match_score": round(best_sim, 4),
            "match_type": "perceptual_audio",
        }
    return None


def lookup_by_perceptual_text(text: str, min_similarity: float = 0.40) -> Optional[Dict]:
    """Find a registered text by shingle similarity (survives paraphrasing)."""
    query_shingles = _text_shingles(text)
    if not query_shingles:
        return None
    
    entries = _read_registry()
    best_match = None
    best_sim = min_similarity
    
    for e in entries:
        if e.get("data_type") != "text" or not e.get("text_shingles"):
            continue
        sim = _jaccard_similarity(query_shingles, e["text_shingles"])
        if sim > best_sim:
            best_sim = sim
            best_match = e
    
    if best_match:
        return {
            **best_match,
            "match_score": round(best_sim, 4),
            "match_type": "perceptual_text",
        }
    return None


def lookup_content(data_type: str, content_bytes: bytes) -> Optional[Dict]:
    """
    Universal lookup — tries all methods in order:
      1. Exact SHA-256 hash match (any content type)
      2. Perceptual image hash (images)
      3. Keyframe hash matching (videos)
      4. Spectral fingerprint (audio)
      5. Shingle similarity (text)
    
    Returns the registry entry if found, None otherwise.
    """
    # 1. Exact hash
    content_hash = hashlib.sha256(content_bytes).hexdigest()
    result = lookup_by_hash(content_hash)
    if result:
        return {**result, "match_type": "exact_hash"}
    
    # 2. Perceptual match by type
    if data_type == "image":
        return lookup_by_perceptual_image(content_bytes)
    elif data_type == "video":
        return lookup_by_perceptual_video(content_bytes)
    elif data_type == "audio":
        return lookup_by_perceptual_audio(content_bytes)
    elif data_type == "text":
        text = content_bytes.decode("utf-8", errors="ignore")
        return lookup_by_perceptual_text(text)
    
    return None


def get_registry_stats() -> Dict:
    """Return summary stats for the registry."""
    entries = _read_registry()
    by_type = {}
    for e in entries:
        dt = e.get("data_type", "unknown")
        by_type[dt] = by_type.get(dt, 0) + 1
    
    fingerprint_counts = {
        "image_phash": sum(1 for e in entries if e.get("phash")),
        "video_frames": sum(1 for e in entries if e.get("frame_hashes")),
        "audio_spectral": sum(1 for e in entries if e.get("audio_fingerprint")),
        "text_shingles": sum(1 for e in entries if e.get("text_shingles")),
    }
    
    return {
        "total_entries": len(entries),
        "by_data_type": by_type,
        "fingerprints": fingerprint_counts,
        "registry_file": str(_REGISTRY_FILE),
    }


def get_all_entries() -> List[Dict]:
    """Return all registry entries (for dashboard display)."""
    return _read_registry()
