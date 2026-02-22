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
  Fingerprint,
  AlertTriangle,
  Mic,
  Square,
  Trash2,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  watermarkContent,
  fileToBase64,
  detectDataType,
  type WatermarkResponse,
  type DataType,
} from "@/lib/api";
import { saveWatermarkResult } from "@/lib/store";
import { blobToWavBase64 } from "@/lib/audio";
import { spendCredits, getBalance, onCreditsChange, CREDIT_COSTS } from "@/lib/credits";

// ── Component ─────────────────────────────────────────────────────
export function WatermarkTab({ onGoToBilling }: { onGoToBilling?: () => void }) {
  const [inputMode, setInputMode] = useState<"text" | "file" | "audio">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [modelName, setModelName] = useState("GPT-4o");
  const [strength, setStrength] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WatermarkResponse | null>(null);
  const [resultDataType, setResultDataType] = useState<DataType>("text");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setBalance(getBalance());
    return onCreditsChange((newBalance) => setBalance(newBalance));
  }, []);

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

  // Clean up on unmount
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

      // Set up analyser for waveform visualization
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start waveform drawing
      drawWaveform();

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Stop the stream tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        // Stop waveform
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        audioCtx.close();
      };

      recorder.start(100); // collect in 100ms chunks
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  }, [audioUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw waveform
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("color") || "#a1a1aa";
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Derive credit cost for current input mode + file type ─────
  const embedCost = (() => {
    if (inputMode === "text") return CREDIT_COSTS.text_watermark;
    if (inputMode === "audio") return CREDIT_COSTS.audio_watermark;
    if (file) {
      const dt = detectDataType(file);
      if (dt === "image") return CREDIT_COSTS.image_watermark;
      if (dt === "audio") return CREDIT_COSTS.audio_watermark;
      if (dt === "video") return CREDIT_COSTS.video_watermark;
      return CREDIT_COSTS.text_watermark;
    }
    return 1;
  })();

  const embed = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    // ── Check balance before hitting the backend ────────────────
    if (getBalance() < embedCost) {
      setError(`Insufficient credits — you need ${embedCost} credit${embedCost !== 1 ? "s" : ""} but have ${getBalance()}. Buy more in the Billing tab.`);
      setLoading(false);
      return;
    }

    try {
      if (inputMode === "text") {
        const res = await watermarkContent({
          data_type: "text",
          data: text,
          watermark_strength: strength,
          model_name: modelName || null,
        });
        setResult(res);
        setResultDataType("text");
        spendCredits(CREDIT_COSTS.text_watermark, "Text watermark");
        saveWatermarkResult({
          dataType: "text",
          label: text.slice(0, 80).replace(/\n/g, " "),
          model: modelName || "Unknown",
          watermarkId: res.watermark_metadata.watermark_id,
        });
      } else if (inputMode === "audio" && audioBlob) {
        // Convert recorded audio → WAV base64
        const wavBase64 = await blobToWavBase64(audioBlob);
        const res = await watermarkContent({
          data_type: "audio",
          data: wavBase64,
          watermark_strength: strength,
          model_name: modelName || null,
        });
        setResult(res);
        setResultDataType("audio");
        spendCredits(CREDIT_COSTS.audio_watermark, "Audio watermark");
        saveWatermarkResult({
          dataType: "audio",
          label: `Recording (${formatTime(recordingTime)})`,
          model: modelName || "Unknown",
          watermarkId: res.watermark_metadata.watermark_id,
        });
      } else if (file) {
        const dataType = detectDataType(file);
        let data: string;
        if (dataType === "text") {
          data = await file.text();
        } else {
          data = await fileToBase64(file);
        }
        const res = await watermarkContent({
          data_type: dataType,
          data,
          watermark_strength: strength,
          model_name: modelName || null,
        });
        setResult(res);
        setResultDataType(dataType);
        const costKey = `${dataType}_watermark` as keyof typeof CREDIT_COSTS;
        spendCredits(CREDIT_COSTS[costKey] ?? 1, `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} watermark`);
        saveWatermarkResult({
          dataType,
          label: file.name,
          model: modelName || "Unknown",
          watermarkId: res.watermark_metadata.watermark_id,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Watermarking failed — is the backend running?"
      );
    } finally {
      setLoading(false);
    }
  }, [inputMode, text, file, audioBlob, recordingTime, strength, modelName]);

  const canEmbed =
    inputMode === "text"
      ? text.trim().length > 0
      : inputMode === "audio"
        ? !!audioBlob
        : !!file;

  const copyOutput = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.watermarked_data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadOutput = () => {
    if (!result) return;

    if (resultDataType === "text") {
      const blob = new Blob([result.watermarked_data], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watermarked-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (resultDataType === "image") {
      const byteString = atob(result.watermarked_data);
      const arr = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watermarked-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (resultDataType === "audio") {
      const byteString = atob(result.watermarked_data);
      const arr = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
      const blob = new Blob([arr], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watermarked-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (resultDataType === "pdf") {
      const byteString = atob(result.watermarked_data);
      const arr = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watermarked-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (resultDataType === "video") {
      const byteString = atob(result.watermarked_data);
      const arr = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
      const blob = new Blob([arr], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watermarked-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const report = {
      watermark_metadata: result.watermark_metadata,
      integrity_proof: result.integrity_proof,
      data_type: resultDataType,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watermark-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── No-credits gate (after ALL hooks) ─────────────────────────
  if (mounted && balance === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[52vh] flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center"
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <Lock className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight">No credits remaining</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            You need credits to embed watermarks. Purchase a pack to unlock this feature.
          </p>
        </div>
        <Button onClick={onGoToBilling} className="gap-2">
          <Sparkles className="size-4" />
          Buy Credits
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="max-w-xl">
        <h2 className="text-2xl font-light tracking-tight">Embed Watermark</h2>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          Embed an invisible cryptographic watermark into text, images, or audio.
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
                  inputMode === mode
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "text"
                  ? "Text / Code"
                  : mode === "file"
                    ? "File Upload"
                    : "Record Audio"}
                {inputMode === mode && (
                  <motion.div
                    layoutId="watermark-mode"
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
                placeholder="Paste or type text content to watermark…"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="resize-none rounded-2xl border-border/40 bg-card font-mono text-[13px] font-light leading-relaxed placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-border"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-light tabular-nums text-muted-foreground/40">
                  {text.length.toLocaleString()} characters ·{" "}
                  {text.split(/\s+/).filter(Boolean).length} words
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
                <p className="text-sm font-light">
                  Click to upload or drag & drop
                </p>
                <p className="mt-1 text-xs font-light text-muted-foreground/40">
                  Text, images, audio, PDF, video — up to 10 MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setFile(e.target.files[0]);
                  }}
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
                        {(file.size / 1024).toFixed(1)} KB ·{" "}
                        {detectDataType(file)}
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
              {/* Waveform / recorder area */}
              <div className="flex flex-col items-center rounded-2xl border border-border/40 bg-card py-8 px-6">
                {/* Live waveform canvas (visible while recording) */}
                {isRecording && (
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={80}
                    className="mb-4 w-full max-w-sm text-muted-foreground"
                    style={{ color: "currentColor" }}
                  />
                )}

                {/* Recording timer */}
                {isRecording && (
                  <div className="mb-4 flex items-center gap-2">
                    <div className="size-2 animate-pulse rounded-full bg-red-500" />
                    <span className="font-mono text-lg font-light tabular-nums">
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                )}

                {/* Idle state */}
                {!isRecording && !audioBlob && (
                  <>
                    <Mic className="mb-3 size-8 text-muted-foreground/30" />
                    <p className="text-sm font-light text-muted-foreground/60">
                      Click to start recording
                    </p>
                    <p className="mt-1 text-xs font-light text-muted-foreground/30">
                      Record voice or audio from your microphone
                    </p>
                  </>
                )}

                {/* Controls */}
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

              {/* Audio preview (after recording) */}
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

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-light text-muted-foreground">
                Model Name
              </Label>
              <Input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. GPT-4o"
                className="h-9 rounded-xl border-border/40 bg-card text-sm font-light"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-light text-muted-foreground">
                Strength ({Math.round(strength * 100)}%)
              </Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(strength * 100)}
                onChange={(e) => setStrength(Number(e.target.value) / 100)}
                className="mt-2 w-full accent-foreground"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Cost:{" "}
                <span className="font-medium text-foreground">
                  {embedCost} credit{embedCost !== 1 ? "s" : ""}
                </span>
              </span>
              <span>
                Balance:{" "}
                <span className={balance < embedCost ? "font-semibold text-red-500" : "font-medium text-foreground"}>
                  {balance.toLocaleString()}
                </span>
              </span>
            </div>
            <Button
              onClick={embed}
              disabled={!canEmbed || loading || balance < embedCost}
              className="h-10 w-full gap-2 rounded-xl text-sm font-light"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Embedding…
                </>
              ) : (
                <>
                  <Fingerprint className="size-4" />
                  Embed Watermark
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
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
                <Skeleton className="h-20 w-full rounded-xl" />
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
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
                {/* Hero */}
                <div className="border-b border-border/30 p-8">
                  <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground">
                    Watermark Embedded
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-light">
                      Successfully embedded
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[10px] font-mono font-normal"
                    >
                      {result.watermark_metadata.embedding_method}
                    </Badge>
                  </div>
                </div>

                {/* Watermarked output (text only) */}
                {resultDataType === "text" && (
                  <div className="border-b border-border/30 px-8 py-5">
                    <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                      Watermarked Output
                    </p>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-secondary/40 p-4">
                      <p className="whitespace-pre-wrap font-mono text-[12px] font-light leading-relaxed">
                        {result.watermarked_data}
                      </p>
                    </div>
                  </div>
                )}

                {/* Image preview */}
                {resultDataType === "image" && (
                  <div className="border-b border-border/30 px-8 py-5">
                    <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                      Watermarked Image
                    </p>
                    <div className="mt-2 flex justify-center rounded-xl bg-secondary/40 p-4">
                      <img
                        src={`data:image/png;base64,${result.watermarked_data}`}
                        alt="Watermarked"
                        className="max-h-64 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Audio notice */}
                {resultDataType === "audio" && (
                  <div className="border-b border-border/30 px-8 py-5">
                    <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                      Watermarked Audio
                    </p>
                    <div className="mt-2 flex justify-center rounded-xl bg-secondary/40 p-4">
                      <audio
                        controls
                        src={`data:audio/wav;base64,${result.watermarked_data}`}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {/* PDF notice */}
                {resultDataType === "pdf" && (
                  <div className="border-b border-border/30 px-8 py-5">
                    <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                      Watermarked PDF
                    </p>
                    <div className="mt-2 flex flex-col items-center gap-3 rounded-xl bg-secondary/40 p-6">
                      <FileText className="size-10 text-muted-foreground/40" />
                      <p className="text-sm font-light text-muted-foreground">
                        PDF watermarked with dual-layer metadata + annotation steganography
                      </p>
                      <p className="text-xs font-light text-muted-foreground/50">
                        Download below to get the watermarked file
                      </p>
                    </div>
                  </div>
                )}

                {/* Video notice */}
                {resultDataType === "video" && (
                  <div className="border-b border-border/30 px-8 py-5">
                    <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                      Watermarked Video
                    </p>
                    <div className="mt-2 flex justify-center rounded-xl bg-secondary/40 p-4">
                      <video
                        controls
                        src={`data:video/avi;base64,${result.watermarked_data}`}
                        className="max-h-64 w-full rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-px bg-border/30">
                  {[
                    {
                      label: "Model",
                      value: result.watermark_metadata.model_name ?? "—",
                    },
                    {
                      label: "Timestamp",
                      value: result.integrity_proof.timestamp
                        .replace("T", " ")
                        .slice(0, 19),
                    },
                  ].map((m) => (
                    <div key={m.label} className="bg-card p-5">
                      <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                        {m.label}
                      </p>
                      <p className="mt-1 truncate text-sm font-light">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Watermark ID */}
                <div className="border-t border-border/30 px-8 py-5">
                  <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                    Watermark ID
                  </p>
                  <p className="mt-1.5 break-all font-mono text-[11px] font-light leading-relaxed text-muted-foreground">
                    {result.watermark_metadata.watermark_id}
                  </p>
                </div>

                {/* Cryptographic details */}
                <div className="border-t border-border/30 px-8 py-5">
                  <p className="mb-3 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/60">
                    Cryptographic Proof
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-light text-muted-foreground">
                        HMAC Signature
                      </span>
                      <span className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground/60">
                        {result.watermark_metadata.cryptographic_signature}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-light text-muted-foreground">
                        Fingerprint
                      </span>
                      <span className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground/60">
                        {result.watermark_metadata.fingerprint_hash}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-light text-muted-foreground">
                        Algorithm
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {result.integrity_proof.algorithm}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 border-t border-border/30 px-8 py-5">
                  {resultDataType === "text" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground"
                      onClick={copyOutput}
                    >
                      {copied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied ? "Copied" : "Copy Output"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground"
                    onClick={downloadOutput}
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground"
                    onClick={downloadReport}
                  >
                    <Download className="size-3.5" />
                    Report
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
                  <div className="space-y-3">
                    <AlertTriangle className="mx-auto size-5 text-destructive" />
                    <p className="text-sm font-light text-destructive">
                      {error}
                    </p>
                    {error.startsWith("Insufficient") ? (
                      <Button size="sm" variant="outline" onClick={onGoToBilling} className="gap-2">
                        <Sparkles className="size-3.5" />
                        Buy Credits
                      </Button>
                    ) : (
                      <p className="text-xs font-light text-muted-foreground/50">
                        Make sure the backend is running on localhost:8000
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Fingerprint className="mx-auto size-5 text-muted-foreground/30" />
                    <p className="text-sm font-light text-muted-foreground/50">
                      Submit content to embed a watermark
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
