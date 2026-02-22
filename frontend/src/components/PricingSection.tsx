"use client";
// ── REPLACED: Apple-style pricing comparison table ───────────────────
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Minus, Loader2, Sparkles } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { CREDIT_PACKS, CreditPack } from "@/lib/credits";
import { Button } from "@/components/ui/button";

// ── Stripe checkout ──────────────────────────────────────────────────
async function startCheckout(packId: string, userId: string) {
  const res = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId, userId }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.error ?? "Checkout failed");
}

// ── Feature rows ─────────────────────────────────────────────────────
type RowValue = string | boolean;

interface FeatureRow {
  label: string;
  values: [RowValue, RowValue, RowValue, RowValue];
  section?: string;
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: "Credits included", section: "Usage", values: ["100", "500", "2,000", "10,000"] },
  { label: "Price per credit", values: ["$0.090", "$0.078", "$0.075", "$0.050"] },
  { label: "Text watermark / verify", section: "Operations (per credit cost)", values: ["100 ops", "500 ops", "2,000 ops", "10,000 ops"] },
  { label: "Image watermark / verify", values: ["50 ops", "250 ops", "1,000 ops", "5,000 ops"] },
  { label: "Audio watermark / verify", values: ["33 ops", "166 ops", "666 ops", "3,333 ops"] },
  { label: "Video watermark / verify", values: ["20 ops", "100 ops", "400 ops", "2,000 ops"] },
  { label: "YouTube content scan", values: ["33 scans", "166 scans", "666 scans", "3,333 scans"] },
  { label: "Credit expiry", section: "Extras", values: ["Never", "Never", "Never", "Never"] },
  { label: "Provenance certificates", values: [true, true, true, true] },
  { label: "API access", values: [true, true, true, true] },
  { label: "Webhook integrations", values: [false, true, true, true] },
  { label: "Priority support", values: [false, false, false, true] },
];

// ── Cell renderer ────────────────────────────────────────────────────
function CellValue({ value }: { value: RowValue }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto size-4 stroke-[2.5]" />
    ) : (
      <Minus className="mx-auto size-4 text-muted-foreground/30 stroke-2" />
    );
  }
  return <span className="text-sm tabular-nums">{value}</span>;
}

// ── Pack header col ──────────────────────────────────────────────────
function PackHeaderCol({
  pack,
  popular,
  userId,
}: {
  pack: CreditPack;
  popular: boolean;
  userId: string;
}) {
  const [loading, setLoading] = useState(false);
  const dollars = (pack.price / 100).toFixed(0);

  const handleBuy = async () => {
    setLoading(true);
    try { await startCheckout(pack.id, userId); }
    catch { setLoading(false); }
  };

  return (
    <div className={`flex flex-col gap-3 px-5 pb-6 pt-5 ${popular ? "bg-foreground/[0.04] dark:bg-foreground/[0.06]" : ""}`}>
      {popular ? (
        <span className="w-fit rounded-full border border-foreground/20 bg-foreground/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Most Popular
        </span>
      ) : (
        <div className="h-5" />
      )}

      <div>
        <p className="text-sm font-semibold">{pack.name}</p>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight">${dollars}</span>
          <span className="text-xs text-muted-foreground">one-time</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-amber-400" />
          {pack.credits.toLocaleString()} credits
        </p>
      </div>

      <Button
        size="sm"
        variant={popular ? "default" : "outline"}
        className="w-full text-xs font-semibold"
        onClick={handleBuy}
        disabled={loading}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : `Get ${pack.name}`}
      </Button>
    </div>
  );
}

// ── Main table ───────────────────────────────────────────────────────
function PricingTable({ userId }: { userId: string }) {
  const popularIdx = CREDIT_PACKS.findIndex((p) => p.popular);

  const colBg = (i: number) =>
    i === popularIdx ? "bg-foreground/[0.04] dark:bg-foreground/[0.06]" : "";

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        {/* Column headers */}
        <thead>
          <tr>
            <th className="w-[220px] border-b border-r border-border px-5 py-0 text-left font-normal" />
            {CREDIT_PACKS.map((pack, i) => (
              <th key={pack.id} className={`border-b border-r border-border last:border-r-0 p-0 font-normal ${colBg(i)}`}>
                <PackHeaderCol pack={pack} popular={i === popularIdx} userId={userId} />
              </th>
            ))}
          </tr>
        </thead>

        {/* Feature rows */}
        <tbody>
          {FEATURE_ROWS.map((row, rowIdx) => {
            const isLast = rowIdx === FEATURE_ROWS.length - 1;
            return (
              <>
                {/* Section label row */}
                {row.section && (
                  <tr key={`section-${row.section}`}>
                    <td
                      colSpan={5}
                      className="border-b border-t border-border bg-secondary/30 px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      {row.section}
                    </td>
                  </tr>
                )}

                {/* Data row */}
                <tr key={row.label} className="group">
                  <td className={`border-r border-border px-5 py-3 text-sm text-muted-foreground transition-colors group-hover:bg-secondary/20 ${isLast ? "" : "border-b"}`}>
                    {row.label}
                  </td>
                  {row.values.map((val, ci) => (
                    <td
                      key={ci}
                      className={`border-r border-border px-5 py-3 text-center font-medium last:border-r-0 transition-colors group-hover:bg-secondary/20 ${isLast ? "" : "border-b"} ${colBg(ci)}`}
                    >
                      <CellValue value={val} />
                    </td>
                  ))}
                </tr>
              </>
            );
          })}
        </tbody>

        {/* Footer buy row */}
        <tfoot>
          <tr>
            <td className="border-t border-border px-5 py-4" />
            {CREDIT_PACKS.map((pack, i) => {
              const [loading, setLoading] = useState(false);
              const handleBuy = async () => {
                setLoading(true);
                try { await startCheckout(pack.id, userId); }
                catch { setLoading(false); }
              };
              return (
                <td key={pack.id} className={`border-t border-r border-border px-5 py-4 last:border-r-0 ${colBg(i)}`}>
                  <Button
                    size="sm"
                    variant={i === popularIdx ? "default" : "outline"}
                    className="w-full text-xs font-semibold"
                    onClick={handleBuy}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="size-3.5 animate-spin" /> : `Get ${pack.name}`}
                  </Button>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Exported component ───────────────────────────────────────────────
interface PricingSectionProps {
  compact?: boolean;
}

export function PricingSection({ compact }: PricingSectionProps) {
  const { user } = useUser();
  const userId = user?.id ?? "guest";

  if (compact) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Buy Credits</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            One-time purchase. Credits never expire. No subscriptions.
          </p>
        </div>
        <PricingTable userId={userId} />
        <p className="text-center text-xs text-muted-foreground">
          Payments processed by{" "}
          <span className="font-medium text-foreground">Stripe</span>. All major cards accepted.
        </p>
      </div>
    );
  }

  return (
    <section id="pricing" className="py-24 px-4">
      <div className="mx-auto max-w-6xl space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pricing
          </p>
          <h2 className="text-4xl font-bold tracking-tight">
            Pay only for what you use
          </h2>
          <p className="mx-auto max-w-lg text-base text-muted-foreground">
            Buy a credit pack once, use it whenever you need. No subscriptions,
            no recurring charges, credits never expire.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <PricingTable userId={userId} />
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          Payments processed by{" "}
          <span className="font-medium text-foreground">Stripe</span>. All major cards accepted.
        </p>
      </div>
    </section>
  );
}
