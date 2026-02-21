/**
 * Audio recording & WAV encoding utilities for Lyra.
 *
 * The backend expects base64-encoded WAV files, but the browser's
 * MediaRecorder produces WebM/Opus. This module provides:
 *   - Microphone recording via MediaRecorder
 *   - WebM → WAV transcoding via AudioContext
 *   - PCM → WAV header encoding
 *   - ArrayBuffer → base64 conversion
 */

// ── WAV encoder ─────────────────────────────────────────────────────

/** Encode raw PCM Float32 samples into a WAV ArrayBuffer (16-bit PCM). */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
  numChannels: number = 1
): ArrayBuffer {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt  sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Convert Float32 → Int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ── Base64 helper ───────────────────────────────────────────────────

/** Convert an ArrayBuffer to a base64 string. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ── Blob → WAV base64 ──────────────────────────────────────────────

/**
 * Convert any audio Blob (WebM, Opus, etc.) to a base64-encoded WAV string.
 * Uses the browser's AudioContext to decode the audio, then re-encodes as WAV.
 */
export async function blobToWavBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Mix down to mono
    const length = audioBuffer.length;
    const numChannels = audioBuffer.numberOfChannels;
    const mono = new Float32Array(length);

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels;
      }
    }

    const wavBuffer = encodeWav(mono, audioBuffer.sampleRate, 1);
    return arrayBufferToBase64(wavBuffer);
  } finally {
    await audioCtx.close();
  }
}

/**
 * Create a Blob URL from a base64 WAV string (for <audio> playback).
 */
export function wavBase64ToBlobUrl(base64: string): string {
  const byteString = atob(base64);
  const arr = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    arr[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([arr], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}
