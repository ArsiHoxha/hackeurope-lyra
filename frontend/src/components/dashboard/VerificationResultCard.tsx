"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldX,
  Copy,
  Download,
  Clock,
  Cpu,
  TrendingUp,
  Check,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface VerificationResult {
  found: boolean;
  confidence: number;
  modelOrigin: string;
  timestamp: string;
  hash: string;
  details: {
    label: string;
    value: number;
  }[];
}

interface VerificationResultCardProps {
  result: VerificationResult;
}

export function VerificationResultCard({ result }: VerificationResultCardProps) {
  const [copied, setCopied] = useState(false);

  const copyReport = () => {
    const report = `CryptoAI Watermark Verification Report
─────────────────────────────────
Status: Watermark ${result.found ? "Found ✅" : "Not Found ❌"}
Confidence: ${result.confidence}%
Model: ${result.modelOrigin}
Timestamp: ${result.timestamp}
Hash: sha256:${result.hash}

Signal Analysis:
${result.details.map((d) => `  ${d.label}: ${d.value}%`).join("\n")}`;

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = () => {
    const report = JSON.stringify(
      {
        status: result.found ? "found" : "not_found",
        confidence: result.confidence,
        model: result.modelOrigin,
        timestamp: result.timestamp,
        hash: result.hash,
        signals: result.details,
      },
      null,
      2
    );
    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watermark-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Card className="overflow-hidden border-border/40 shadow-sm">
        {/* Status header */}
        <div
          className={`flex items-center gap-3 px-5 py-3.5 ${
            result.found
              ? "bg-success/8 text-success"
              : "bg-destructive/8 text-destructive"
          }`}
        >
          {result.found ? (
            <ShieldCheck className="size-5" />
          ) : (
            <ShieldX className="size-5" />
          )}
          <span className="text-[14px] font-semibold">
            Watermark {result.found ? "Found" : "Not Found"}
          </span>
          <Badge
            className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              result.found
                ? "bg-success/15 text-success hover:bg-success/20"
                : "bg-destructive/15 text-destructive hover:bg-destructive/20"
            }`}
          >
            {result.found ? "Verified" : "Unverified"}
          </Badge>
        </div>

        <CardHeader className="pb-3 pt-5">
          <CardTitle className="text-[15px]">Forensic Report</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Key metrics */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                label: "Confidence",
                value: `${result.confidence}%`,
              },
              {
                icon: Cpu,
                label: "Model Origin",
                value: result.modelOrigin,
              },
              {
                icon: Clock,
                label: "Timestamp",
                value: result.timestamp,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8">
                  <metric.icon className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="truncate text-[13px] font-semibold">
                    {metric.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Fingerprint hash */}
          <div>
            <p className="mb-2 text-[13px] font-medium">Fingerprint Hash</p>
            <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3.5 py-2.5 font-mono text-[12px]">
              <span className="flex-1 truncate text-muted-foreground">
                <span className="text-foreground">sha256:</span>
                {result.hash}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => navigator.clipboard.writeText(result.hash)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Copy className="size-3" />
              </Button>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Signal analysis */}
          <div>
            <p className="mb-3.5 text-[13px] font-medium">Signal Analysis</p>
            <div className="space-y-3">
              {result.details.map((detail) => (
                <div key={detail.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{detail.label}</span>
                    <span className="font-medium">{detail.value}%</span>
                  </div>
                  <Progress
                    value={detail.value}
                    className="h-[6px] rounded-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg border-border/50 text-[13px]"
              onClick={copyReport}
            >
              {copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy Report"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg border-border/50 text-[13px]"
              onClick={downloadReport}
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
