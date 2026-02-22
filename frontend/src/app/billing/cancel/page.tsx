"use client";

import { motion } from "framer-motion";
import { XCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="flex max-w-md flex-col items-center gap-6 rounded-3xl border bg-card p-10 text-center shadow-xl"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
          <XCircle className="size-10 text-rose-500" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Payment cancelled</h1>
          <p className="text-muted-foreground text-sm">
            No charge was made. You can try again any time from the Billing tab.
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => router.push("/dashboard?tab=billing")}
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Button>
      </motion.div>
    </div>
  );
}
