"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldX,
  Copy,
  Share2,
  Clock,
  Cpu,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
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

export function VerificationResultCard({
  result,
}: VerificationResultCardProps) {
  const copyHash = () => {
    navigator.clipboard.writeText(result.hash);
  };

  const shareResult = () => {
    if (navigator.share) {
      navigator.share({
        title: "Attestify Watermark Verification",
        text: `Watermark ${result.found ? "Found" : "Not Found"} — Confidence: ${result.confidence}%`,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden">
        {/* Status banner */}
        <div
          className={`px-6 py-3 ${
            result.found
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.found ? (
              <ShieldCheck className="size-5" />
            ) : (
              <ShieldX className="size-5" />
            )}
            <span className="font-semibold">
              Watermark {result.found ? "Found" : "Not Found"}
            </span>
            <Badge
              className={`ml-auto ${
                result.found
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-white"
              }`}
            >
              {result.found ? "Verified" : "Unverified"}
            </Badge>
          </div>
        </div>

        <CardHeader>
          <CardTitle className="text-lg">Forensic Report</CardTitle>
          <CardDescription>
            Detailed analysis of cryptographic watermark signals.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Key metrics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <TrendingUp className="size-5 text-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-lg font-bold">{result.confidence}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Cpu className="size-5 text-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Model Origin</p>
                <p className="text-sm font-semibold">{result.modelOrigin}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Clock className="size-5 text-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Timestamp</p>
                <p className="text-sm font-semibold">{result.timestamp}</p>
              </div>
            </div>
          </div>

          {/* Fingerprint hash */}
          <div>
            <p className="mb-2 text-sm font-medium">Fingerprint Hash</p>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 font-mono text-xs">
              <span className="flex-1 truncate text-muted-foreground">
                <span className="text-foreground">sha256:</span> {result.hash}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={copyHash}
                className="shrink-0"
              >
                <Copy className="size-3" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Signal analysis */}
          <div>
            <p className="mb-4 text-sm font-medium">Signal Analysis</p>
            <div className="space-y-3">
              {result.details.map((detail) => (
                <div key={detail.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {detail.label}
                    </span>
                    <span className="font-medium">{detail.value}%</span>
                  </div>
                  <Progress value={detail.value} className="h-2" />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={copyHash}>
              <Copy className="size-3.5" />
              Copy Report
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={shareResult}>
              <Share2 className="size-3.5" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
