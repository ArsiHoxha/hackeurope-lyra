"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";
import { getWallet, onCreditsChange, CreditTransaction, CREDIT_COSTS } from "@/lib/credits";
import { PricingSection } from "@/components/PricingSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function TransactionRow({ tx }: { tx: CreditTransaction }) {
  const isPurchase = tx.type === "purchase";
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className={`flex size-8 flex-shrink-0 items-center justify-center rounded-full ${
          isPurchase
            ? "bg-emerald-100 dark:bg-emerald-900/30"
            : "bg-rose-100 dark:bg-rose-900/30"
        }`}
      >
        {isPurchase ? (
          <ArrowDownLeft className="size-4 text-emerald-500" />
        ) : (
          <ArrowUpRight className="size-4 text-rose-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{tx.description}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          {formatDate(tx.timestamp)}
        </p>
      </div>
      <span
        className={`text-sm font-bold tabular-nums ${
          isPurchase ? "text-emerald-500" : "text-rose-500"
        }`}
      >
        {isPurchase ? "+" : ""}
        {tx.amount.toLocaleString()}
      </span>
    </div>
  );
}

export function BillingTab() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  const sync = () => {
    const w = getWallet();
    setBalance(w.balance);
    setTransactions(w.transactions);
  };

  useEffect(() => {
    sync();
    return onCreditsChange(sync);
  }, []);

  const creditCosts = Object.entries(CREDIT_COSTS).map(([k, v]) => ({
    label: k.replace(/_/g, " "),
    cost: v,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        {/* Credit balance */}
        <Card className="w-full sm:max-w-xs rounded-3xl border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="size-4 text-amber-400" />
              Credit balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-extrabold tracking-tight">
              {balance.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              credits remaining
            </p>
          </CardContent>
        </Card>

        {/* Credit costs quick reference */}
        <Card className="flex-1 rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Credit costs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {creditCosts.map(({ label, cost }) => (
                <div
                  key={label}
                  className="flex flex-col rounded-xl bg-secondary/50 px-3 py-2"
                >
                  <span className="text-[11px] capitalize text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-sm font-bold">{cost} cr</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pricing packs */}
      <div>
        <PricingSection compact />
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Transaction history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <TransactionRow tx={tx} />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {transactions.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <Sparkles className="size-8 opacity-40" />
          <p className="text-sm">No transactions yet — buy your first credit pack above.</p>
        </div>
      )}

      {/* Stripe badge */}
      <p className="text-center text-xs text-muted-foreground">
        Payments securely processed by{" "}
        <span className="font-semibold text-foreground">Stripe</span>.
      </p>
    </div>
  );
}
