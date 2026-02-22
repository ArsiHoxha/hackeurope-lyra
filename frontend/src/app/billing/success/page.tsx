"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { addCredits, CREDIT_PACKS } from "@/lib/credits";
import { Button } from "@/components/ui/button";

interface VerifyResult {
  sessionId: string;
  packId: string;
  credits: number;
  amountTotal: number;
}

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const mode = searchParams.get("mode") ?? "live";
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const processed = useRef(false);

  useEffect(() => {
    if (!sessionId || processed.current) return;
    processed.current = true;

    fetch(`/api/stripe/verify-session?session_id=${sessionId}&mode=${mode}`)
      .then((r) => r.json())
      .then((data: VerifyResult & { error?: string }) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        const pack = CREDIT_PACKS.find((p) => p.id === data.packId);
        addCredits(
          data.credits,
          `${pack?.name ?? "Unknown"} pack — ${data.credits} credits`,
          data.sessionId
        );
        setResult(data);
      })
      .catch(() => setError("Failed to verify payment. Please contact support."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
        <p className="text-destructive font-medium">{error}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const pack = CREDIT_PACKS.find((p) => p.id === result?.packId);
  const amount = ((result?.amountTotal ?? 0) / 100).toFixed(2);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="flex max-w-md flex-col items-center gap-6 rounded-3xl border bg-card p-10 text-center shadow-xl"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
          className="flex size-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30"
        >
          <CheckCircle2 className="size-10 text-emerald-500" />
        </motion.div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Payment successful!</h1>
          <p className="text-muted-foreground text-sm">
            Your credits have been added to your account.
          </p>
        </div>

        {/* Credits summary */}
        <div className="w-full rounded-2xl border bg-secondary/40 px-6 py-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pack</span>
            <span className="font-semibold">{pack?.name ?? result?.packId}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credits added</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-400" />
              <span className="font-bold text-foreground">
                +{result?.credits.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount paid</span>
            <span className="font-semibold">${amount}</span>
          </div>
        </div>

        <Button
          className="w-full gap-2"
          onClick={() => router.push("/dashboard?tab=billing")}
        >
          Go to Dashboard
          <ArrowRight className="size-4" />
        </Button>
      </motion.div>
    </div>
  );
}
