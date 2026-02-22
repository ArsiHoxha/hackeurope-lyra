/**
 * Attestify Watermarking API client
 *
 * Connects the Next.js frontend to the FastAPI backend at /api/watermark
 * and /api/verify.  All network calls go through these typed helpers.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Request / Response types ────────────────────────────────────────

export type DataType = "text" | "image" | "audio" | "pdf" | "video";

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
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("video/") || /\.(mp4|avi|mkv|mov|webm)$/i.test(file.name)) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "text";
}


// ── Security API ────────────────────────────────────────────────────

export interface SecurityConfig {
  key_rotation_epoch: number;
  key_last_rotated: string | null;
  entropy_level: "standard" | "high" | "maximum";
  rate_limit_enabled: boolean;
  rate_limit_rpm: number;
  anti_scraping_enabled: boolean;
  audit_last_run: string | null;
  webhook_url: string | null;
  two_factor_enabled: boolean;
  provenance_chain_enabled: boolean;
  api_key_count: number;
  total_api_keys: number;
}

export interface SecurityAuditCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: "critical" | "high" | "medium" | "low";
  weight: number;
  fix_action: string;
}

export interface SecurityAuditResult {
  score: number;
  checks: SecurityAuditCheck[];
  total: number;
  passed: number;
  failed: number;
  audited_at: string;
}

export interface ApiKeyInfo {
  id: string;
  scope: string;
  created: string;
  expires: string;
  revoked: boolean;
  prefix: string;
}

export interface GeneratedApiKey extends ApiKeyInfo {
  api_key: string;
  key_id: string;
}

export interface ProvenanceCertificate {
  version: string;
  content_hash: string;
  content_size_bytes: number;
  data_type: string;
  model_name: string;
  provenance_id: string;
  origin_proof: string;
  anti_scrape_fingerprint: string;
  chain_hash: string;
  issued_at: string;
  issuer: string;
  algorithm: string;
  key_epoch: number;
  entropy_level: string;
  claims: {
    ip_protection: boolean;
    anti_scraping: boolean;
    tamper_evident: boolean;
    provenance_verified: boolean;
  };
}

export interface ProvenanceVerifyResult {
  valid: boolean;
  checks: {
    content_hash: boolean;
    provenance_id: boolean;
    origin_proof: boolean;
    chain_integrity: boolean;
  };
  content_hash: string;
  verified_at: string;
}

export interface ScrapingFingerprint {
  fingerprint: string;
  nonce: string;
  scraping_alert: boolean;
  requests_last_minute: number;
}

export interface KeyRotationResult {
  epoch: number;
  rotated_at: string;
  message: string;
}

/** Get current security configuration. */
export async function getSecurityConfig(): Promise<SecurityConfig> {
  const res = await fetch(`${API_BASE}/api/security/config`);
  if (!res.ok) throw new Error("Failed to fetch security config");
  return res.json();
}

/** Update security settings. */
export async function updateSecurityConfig(
  updates: Partial<SecurityConfig>
): Promise<SecurityConfig> {
  return post<SecurityConfig>("/api/security/config", updates);
}

/** Run security audit. */
export async function runSecurityAudit(): Promise<SecurityAuditResult> {
  return post<SecurityAuditResult>("/api/security/audit", {});
}

/** Rotate deployment key. */
export async function rotateKey(): Promise<KeyRotationResult> {
  return post<KeyRotationResult>("/api/security/rotate-key", {});
}

/** Generate a scoped API key. */
export async function generateApiKey(
  scope: "read" | "write" | "admin" = "read",
  expiresInDays: number = 30
): Promise<GeneratedApiKey> {
  return post<GeneratedApiKey>("/api/security/api-keys/generate", {
    scope,
    expires_in_days: expiresInDays,
  });
}

/** List all API keys (masked). */
export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const res = await fetch(`${API_BASE}/api/security/api-keys`);
  if (!res.ok) throw new Error("Failed to list API keys");
  return res.json();
}

/** Revoke an API key. */
export async function revokeApiKey(keyId: string): Promise<void> {
  await post("/api/security/api-keys/revoke", { key_id: keyId });
}

/** Generate a provenance certificate. */
export async function generateProvenance(
  content: string,
  dataType: DataType = "text",
  modelName?: string
): Promise<ProvenanceCertificate> {
  return post<ProvenanceCertificate>("/api/security/provenance", {
    content,
    data_type: dataType,
    model_name: modelName,
  });
}

/** Verify a provenance certificate. */
export async function verifyProvenance(
  content: string,
  dataType: DataType,
  certificate: ProvenanceCertificate
): Promise<ProvenanceVerifyResult> {
  return post<ProvenanceVerifyResult>("/api/security/provenance/verify", {
    content,
    data_type: dataType,
    certificate,
  });
}

/** Generate anti-scraping fingerprint. */
export async function generateFingerprint(
  content: string,
  dataType: DataType = "text"
): Promise<ScrapingFingerprint> {
  return post<ScrapingFingerprint>("/api/security/fingerprint", {
    content,
    data_type: dataType,
  });
}
