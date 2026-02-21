"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DemoInputCard } from "@/components/DemoInputCard";
import {
  VerificationResultCard,
  type VerificationResult,
} from "@/components/VerificationResultCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Simulated verification results for the demo
function simulateVerification(): VerificationResult {
  const found = Math.random() > 0.3;
  const confidence = found
    ? Math.floor(85 + Math.random() * 15)
    : Math.floor(5 + Math.random() * 25);

  const models = ["GPT-4o", "Claude 3.5", "Gemini Pro", "Llama 3", "Mistral Large"];
  const modelOrigin = models[Math.floor(Math.random() * models.length)];

  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }

  return {
    found,
    confidence,
    modelOrigin,
    timestamp,
    hash,
    details: [
      {
        label: "Token Distribution Anomaly",
        value: found ? Math.floor(75 + Math.random() * 25) : Math.floor(10 + Math.random() * 30),
      },
      {
        label: "Frequency Domain Signal",
        value: found ? Math.floor(80 + Math.random() * 20) : Math.floor(5 + Math.random() * 20),
      },
      {
        label: "Statistical Fingerprint Match",
        value: found ? Math.floor(70 + Math.random() * 30) : Math.floor(8 + Math.random() * 25),
      },
      {
        label: "Entropy Pattern Correlation",
        value: found ? Math.floor(65 + Math.random() * 35) : Math.floor(3 + Math.random() * 15),
      },
    ],
  };
}

interface HistoryEntry {
  id: string;
  content: string;
  type: "text" | "file";
  result: VerificationResult;
}

export default function DemoPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<VerificationResult | null>(
    null
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleVerify = async (content: string, type: "text" | "file") => {
    setIsLoading(true);
    setCurrentResult(null);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));

    const result = simulateVerification();
    setCurrentResult(result);
    setIsLoading(false);

    const entry: HistoryEntry = {
      id: Date.now().toString(),
      content: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
      type,
      result,
    };
    setHistory((prev) => [entry, ...prev]);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Watermark Verification
          </h1>
          <p className="mt-2 text-muted-foreground">
            Submit AI-generated content to check for embedded cryptographic
            watermarks. Results are simulated for this demo.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left: Input + Result */}
          <div className="space-y-6 lg:col-span-3">
            <DemoInputCard onVerify={handleVerify} isLoading={isLoading} />

            {/* Loading skeleton */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card>
                    <CardContent className="space-y-4 py-6">
                      <div className="flex items-center gap-3">
                        <div className="size-10 animate-pulse rounded-full bg-muted" />
                        <div className="space-y-2">
                          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full animate-pulse rounded bg-muted" />
                        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-16 animate-pulse rounded-lg bg-muted"
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
              {currentResult && !isLoading && (
                <VerificationResultCard result={currentResult} />
              )}
            </AnimatePresence>
          </div>

          {/* Right: History panel */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="size-4" />
                      Verification History
                    </CardTitle>
                    {history.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={clearHistory}
                        className="text-muted-foreground"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <History className="mb-3 size-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        No verifications yet
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Results will appear here after verification.
                      </p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {history.map((entry) => (
                        <AccordionItem key={entry.id} value={entry.id}>
                          <AccordionTrigger className="py-3 text-sm hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`text-[10px] ${
                                  entry.result.found
                                    ? "bg-success/10 text-success"
                                    : "bg-destructive/10 text-destructive"
                                }`}
                              >
                                {entry.result.found ? "Found" : "Not Found"}
                              </Badge>
                              <span className="max-w-[160px] truncate text-xs text-muted-foreground">
                                {entry.content}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Confidence
                                </span>
                                <span className="font-medium">
                                  {entry.result.confidence}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Model
                                </span>
                                <span className="font-medium">
                                  {entry.result.modelOrigin}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Time
                                </span>
                                <span className="font-medium">
                                  {entry.result.timestamp}
                                </span>
                              </div>
                              <div className="mt-2 truncate rounded bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">
                                {entry.result.hash}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
