/**
 * Lyra Watermarking API client
 *
 * Connects the Next.js frontend to the FastAPI backend at /api/watermark
 * and /api/verify.  All network calls go through these typed helpers.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Request / Response types ────────────────────────────────────────

export type DataType = "text" | "image" | "audio";

export interface WatermarkRequest {
  data_type: DataType;
  data: string; // UTF-8 text or base64-encoded binary
  watermark_strength?: number; // 0.0 – 1.0, default 0.8
  model_name?: string | null;
}

export interface VerifyRequest {
  data_type: DataType;
  data: string; // UTF-8 text or base64-encoded binary
  model_name?: string | null;
}

// — /api/watermark response -------------------------------------------------

export interface WatermarkMetadata {
  watermark_id: string;
  embedding_method: string;
  cryptographic_signature: string;
  fingerprint_hash: string;
  model_name: string | null;
}

export interface WatermarkResponse {
  watermarked_data: string;
  watermark_metadata: WatermarkMetadata;
  integrity_proof: {
    algorithm: string;
    timestamp: string;
  };
}

// — /api/verify response ----------------------------------------------------

export interface VerificationResult {
  watermark_detected: boolean;
  confidence_score: number; // 0 – 1
  matched_watermark_id: string | null;
  model_name: string | null;
}

export interface ForensicDetails {
  signature_valid: boolean;
  tamper_detected: boolean;
  statistical_score: number;
}

export interface VerifyResponse {
  verification_result: VerificationResult;
  forensic_details: ForensicDetails;
  analysis_timestamp: string;
}

// — /health ------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  mode: string;
  registry: string;
}

// ── API helpers ─────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} failed (${res.status}): ${detail}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API functions ────────────────────────────────────────────

/** Embed a watermark into content (text, image, or audio). */
export async function watermarkContent(
  req: WatermarkRequest
): Promise<WatermarkResponse> {
  return post<WatermarkResponse>("/api/watermark", req);
}

/** Verify whether content contains a watermark. */
export async function verifyContent(
  req: VerifyRequest
): Promise<VerifyResponse> {
  return post<VerifyResponse>("/api/verify", req);
}

/** Check backend health. */
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend unreachable");
  return res.json() as Promise<HealthResponse>;
}

/**
 * Read a File as base64 (for image / audio uploads).
 * Returns the raw base64 string (no data-URI prefix).
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:…;base64," prefix
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Detect the data type from a file's MIME type.
 */
export function detectDataType(file: File): DataType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "text";
}
