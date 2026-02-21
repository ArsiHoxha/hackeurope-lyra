"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  Loader2,
  Copy,
  Download,
  Check,
  ArrowRight,
  AlertTriangle,
  Mic,
  Square,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  verifyContent,
  fileToBase64,
  detectDataType,
  type VerifyResponse,
} from "@/lib/api";
import { saveVerifyResult } from "@/lib/store";
import { blobToWavBase64 } from "@/lib/audio";

// ── Types ─────────────────────────────────────────────────────────
export interface VerificationResult {
  found: boolean;
  confidence: number;
  modelOrigin: string;
  timestamp: string;
  hash: string;
  tamperDetected: boolean;
  signatureValid: boolean;
  statisticalScore: number;
  details: { label: string; value: number }[];
}

// ── Map API response → UI model ──────────────────────────────────
function mapResponse(res: VerifyResponse): VerificationResult {
  const vr = res.verification_result;
  const fd = res.forensic_details;
  const confPct = Math.round(vr.confidence_score * 100);

  return {
    found: vr.watermark_detected,
    confidence: confPct,
    modelOrigin: vr.model_name ?? "Unknown",
    timestamp: res.analysis_timestamp.replace("T", " ").slice(0, 19) + " UTC",
    hash: vr.matched_watermark_id ?? "—",
    tamperDetected: fd.tamper_detected,
    signatureValid: fd.signature_valid,
    statisticalScore: fd.statistical_score,
    details: [
      { label: "Confidence Score", value: confPct },
      { label: "Statistical Score", value: Math.min(100, Math.round(Math.abs(fd.statistical_score) * 10)) },
      { label: "Signature Valid", value: fd.signature_valid ? 100 : 0 },
      { label: "Tamper Detection", value: fd.tamper_detected ? 100 : 0 },
    ],
  };
}

// ── Component ─────────────────────────────────────────────────────
export function VerifyTab() {
  const [inputMode, setInputMode] = useState<"text" | "file" | "audio">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Audio recording state ─────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      drawWaveform();

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        audioCtx.close();
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setError("Microphone access denied.");
    }
  }, [audioUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const discardRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  }, [audioUrl]);

  const drawWaveform = useCallback(() => {
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("color") || "#a1a1aa";
      ctx.beginPath();
      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const verify = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      if (inputMode === "text") {
        const res = await verifyContent({
          data_type: "text",
          data: text,
        });
        const mapped = mapResponse(res);
        setResult(mapped);
        saveVerifyResult({
          dataType: "text",
          label: text.slice(0, 80).replace(/\n/g, " "),
          model: mapped.modelOrigin,
          found: mapped.found,
          confidence: mapped.confidence,
          signatureValid: mapped.signatureValid,
          tamperDetected: mapped.tamperDetected,
          statisticalScore: mapped.statisticalScore,
          watermarkId: mapped.hash,
        });
      } else if (inputMode === "audio" && audioBlob) {
        const wavBase64 = await blobToWavBase64(audioBlob);
        const res = await verifyContent({
          data_type: "audio",
          data: wavBase64,
        });
        const mapped = mapResponse(res);
        setResult(mapped);
        saveVerifyResult({
          dataType: "audio",
          label: `Recording (${formatTime(recordingTime)})`,
          model: mapped.modelOrigin,
          found: mapped.found,
          confidence: mapped.confidence,
          signatureValid: mapped.signatureValid,
          tamperDetected: mapped.tamperDetected,
          statisticalScore: mapped.statisticalScore,
          watermarkId: mapped.hash,
        });
      } else if (file) {
        const dataType = detectDataType(file);

        let data: string;
        if (dataType === "text") {
          data = await file.text();
        } else {
          data = await fileToBase64(file);
        }

        const res = await verifyContent({
          data_type: dataType,
          data,
        });
        const mapped = mapResponse(res);
        setResult(mapped);
        saveVerifyResult({
          dataType,
          label: file.name,
          model: mapped.modelOrigin,
          found: mapped.found,
          confidence: mapped.confidence,
          signatureValid: mapped.signatureValid,
          tamperDetected: mapped.tamperDetected,
          statisticalScore: mapped.statisticalScore,
          watermarkId: mapped.hash,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed — is the backend running?"
      );
    } finally {
      setLoading(false);
    }
  }, [inputMode, text, file, audioBlob, recordingTime]);

  const canVerify =
    inputMode === "text"
      ? text.trim().length > 0
      : inputMode === "audio"
        ? !!audioBlob
        : !!file;

  const copyReport = () => {
    if (!result) return;
    navigator.clipboard.writeText(
      `Watermark ${result.found ? "Found" : "Not Found"}\nConfidence: ${result.confidence}%\nModel: ${result.modelOrigin}\nSignature Valid: ${result.signatureValid}\nTamper Detected: ${result.tamperDetected}\nWatermark ID: ${result.hash}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="max-w-xl">
        <h2 className="text-2xl font-light tracking-tight">Verify Watermark</h2>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          Submit content to scan for embedded cryptographic fingerprints.
        </p>
      </div>

      {/* Two-column layout: Input + Result */}
      <div className="grid gap-10 lg:grid-cols-2">
        {/* ── Left: Input ────────────────────────────── */}
        <div className="space-y-6">
          {/* Mode toggle */}
          <div className="flex gap-6 border-b border-border/30 pb-px">
            {(["text", "file", "audio"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`relative pb-3 text-sm font-light transition-colors ${
                  inputMode === mode ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "text"
                  ? "Text / Code"
                  : mode === "file"
                    ? "File Upload"
                    : "Record Audio"}
                {inputMode === mode && (
                  <motion.div
                    layoutId="verify-mode"
                    className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Text input */}
          {inputMode === "text" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <Textarea
                placeholder="Paste AI-generated text, code, or content here…"
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="resize-none rounded-2xl border-border/40 bg-card font-mono text-[13px] font-light leading-relaxed placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-border"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-light tabular-nums text-muted-foreground/40">
                  {text.length.toLocaleString()} characters
                </span>
              </div>
            </motion.div>
          )}

          {/* File input */}
          {inputMode === "file" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div
                className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-border/40 bg-card py-16 transition-colors hover:border-border"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mb-3 size-5 text-muted-foreground/40" />
                <p className="text-sm font-light">Click to upload or drag & drop</p>
                <p className="mt-1 text-xs font-light text-muted-foreground/40">
                  Text, images, audio, PDF, video — up to 10 MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                  accept=".txt,.py,.js,.ts,.jsx,.tsx,.md,.json,.png,.jpg,.jpeg,.webp,.wav,.pdf,.mp4,.avi,.mkv,.mov,.webm"
                />
              </div>
              {file && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-xl border border-border/30 bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="size-4 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-light">{file.name}</p>
                      <p className="text-[11px] font-light text-muted-foreground/40">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Audio recording */}
          {inputMode === "audio" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center rounded-2xl border border-border/40 bg-card py-8 px-6">
                {isRecording && (
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={80}
                    className="mb-4 w-full max-w-sm text-muted-foreground"
                    style={{ color: "currentColor" }}
                  />
                )}

                {isRecording && (
                  <div className="mb-4 flex items-center gap-2">
                    <div className="size-2 animate-pulse rounded-full bg-red-500" />
                    <span className="font-mono text-lg font-light tabular-nums">
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                )}

                {!isRecording && !audioBlob && (
                  <>
                    <Mic className="mb-3 size-8 text-muted-foreground/30" />
                    <p className="text-sm font-light text-muted-foreground/60">
                      Record watermarked audio for verification
                    </p>
                    <p className="mt-1 text-xs font-light text-muted-foreground/30">
                      Play the watermarked audio near your microphone, or record directly
                    </p>
                  </>
                )}

                <div className="mt-4 flex items-center gap-3">
                  {!isRecording && !audioBlob && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 rounded-full border-red-500/30 px-6 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                      onClick={startRecording}
                    >
                      <Mic className="size-4" />
                      Start Recording
                    </Button>
                  )}
                  {isRecording && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 rounded-full border-border px-6"
                      onClick={stopRecording}
                    >
                      <Square className="size-3.5 fill-current" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>

              {audioUrl && !isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 rounded-xl border border-border/30 bg-card px-4 py-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="size-4 text-muted-foreground/50" />
                      <span className="text-sm font-light">
                        Recording · {formatTime(recordingTime)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={discardRecording}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <audio controls src={audioUrl} className="w-full" />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Submit */}
          <Button
            onClick={verify}
            disabled={!canVerify || loading}
            className="h-10 w-full gap-2 rounded-xl text-sm font-light"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                Verify
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </div>

        {/* ── Right: Result ──────────────────────────── */}
        <div>
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 rounded-2xl border border-border/50 bg-card p-8"
              >
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-12 w-24 rounded-xl" />
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </div>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-0 overflow-hidden rounded-2xl border border-border/50 bg-card"
              >
                {/* Hero stat */}
                <div className="border-b border-border/30 p-8">
                  <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground">
                    Result
                  </p>
                  <div className="mt-4 flex items-baseline gap-3">
                    <span className="text-5xl font-extralight tracking-tight">
                      {result.confidence}%
                    </span>
                    <span className="text-sm font-light text-muted-foreground">
                      confidence
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className={`size-1.5 rounded-full ${result.found ? "bg-foreground" : "bg-border"}`} />
                    <span className="text-sm font-light">
                      Watermark {result.found ? "detected" : "not found"}
                    </span>
                  </div>
                  {/* Forensic badges */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant={result.signatureValid ? "default" : "secondary"} className="text-[10px] font-normal">
                      {result.signatureValid ? "Signature Valid" : "Signature Invalid"}
                    </Badge>
                    {result.tamperDetected && (
                      <Badge variant="destructive" className="gap-1 text-[10px] font-normal">
                        <AlertTriangle className="size-3" />
                        Tamper Detected
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-px bg-border/30">
                  {[
                    { label: "Model", value: result.modelOrigin },
                    { label: "Timestamp", value: result.timestamp.slice(0, 16) },
                  ].map((m) => (
                    <div key={m.label} className="bg-card p-5">
                      <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                        {m.label}
                      </p>
                      <p className="mt-1 truncate text-sm font-light">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Hash */}
                <div className="border-t border-border/30 px-8 py-5">
                  <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                    SHA-256 Watermark ID
                  </p>
                  <p className="mt-1.5 break-all font-mono text-[11px] font-light leading-relaxed text-muted-foreground">
                    {result.hash}
                  </p>
                </div>

                {/* Signal analysis */}
                <div className="border-t border-border/30 px-8 py-6">
                  <p className="mb-5 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                    Signal Analysis
                  </p>
                  <div className="space-y-4">
                    {result.details.map((d) => (
                      <div key={d.label}>
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className="text-[13px] font-light">{d.label}</span>
                          <span className="text-xs font-light tabular-nums text-muted-foreground">
                            {d.value}%
                          </span>
                        </div>
                        <div className="h-[2px] overflow-hidden rounded-full bg-secondary">
                          <motion.div
                            className="h-full rounded-full bg-foreground/60"
                            initial={{ width: 0 }}
                            animate={{ width: `${d.value}%` }}
                            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 border-t border-border/30 px-8 py-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground"
                    onClick={copyReport}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground"
                    onClick={downloadJSON}
                  >
                    <Download className="size-3.5" />
                    Export
                  </Button>
                </div>
              </motion.div>
            )}

            {!result && !loading && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/30 p-8 text-center"
              >
                {error ? (
                  <div className="space-y-2">
                    <AlertTriangle className="mx-auto size-5 text-destructive" />
                    <p className="text-sm font-light text-destructive">
                      {error}
                    </p>
                    <p className="text-xs font-light text-muted-foreground/50">
                      Make sure the backend is running on localhost:8000
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-light text-muted-foreground/50">
                    Submit content to see results
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
