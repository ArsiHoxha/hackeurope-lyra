/**
 * Local history store for watermark & verify operations.
 * Data lives in localStorage so it persists across page reloads.
 */

export type DataType = "text" | "image" | "audio" | "pdf" | "video";
export type OperationType = "watermark" | "verify";

export interface HistoryEntry {
  id: string;
  operation: OperationType;
  dataType: DataType;
  /** Short preview or filename */
  label: string;
  /** ISO timestamp */
  timestamp: string;
  /** Model that produced the content */
  model: string;
  /** Content category e.g. medical, legal */
  context?: string | null;
  /** true if watermark was detected (verify) or successfully embedded (watermark) */
  success: boolean;
  /** 0–100 */
  confidence: number;
  /** Extra metadata stored for analytics */
  signatureValid?: boolean;
  tamperDetected?: boolean;
  statisticalScore?: number;
  watermarkId?: string;
  riskScore?: number;
  riskLevel?: "Low" | "Medium" | "High";
}

const STORAGE_KEY = "attestify_history";

// ── Read / write helpers ──────────────────────────────────────────

function read(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  // Notify any listeners
  window.dispatchEvent(new Event("attestify-history-change"));
}

// ── Public API ────────────────────────────────────────────────────

export function getHistory(): HistoryEntry[] {
  return read().sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function addEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const all = read();
  all.unshift(full);
  // Cap at 500 entries
  write(all.slice(0, 500));
  return full;
}

export function removeEntry(id: string) {
  write(read().filter((e) => e.id !== id));
}

export function clearHistory() {
  write([]);
}

// ── Shortcut: save watermark result ───────────────────────────────

export function saveWatermarkResult(opts: {
  dataType: DataType;
  label: string;
  model: string;
  context?: string | null;
  watermarkId: string;
}) {
  return addEntry({
    operation: "watermark",
    dataType: opts.dataType,
    label: opts.label,
    model: opts.model,
    context: opts.context,
    success: true,
    confidence: 100,
    watermarkId: opts.watermarkId,
  });
}

// ── Shortcut: save verify result ──────────────────────────────────

export function saveVerifyResult(opts: {
  dataType: DataType;
  label: string;
  model: string;
  context?: string | null;
  found: boolean;
  confidence: number;
  signatureValid: boolean;
  tamperDetected: boolean;
  statisticalScore: number;
  watermarkId: string;
  riskScore?: number;
  riskLevel?: "Low" | "Medium" | "High";
}) {
  return addEntry({
    operation: "verify",
    dataType: opts.dataType,
    label: opts.label,
    model: opts.model,
    context: opts.context,
    success: opts.found,
    confidence: opts.confidence,
    signatureValid: opts.signatureValid,
    tamperDetected: opts.tamperDetected,
    statisticalScore: opts.statisticalScore,
    watermarkId: opts.watermarkId,
    riskScore: opts.riskScore,
    riskLevel: opts.riskLevel,
  });
}
