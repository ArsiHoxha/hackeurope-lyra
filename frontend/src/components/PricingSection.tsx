"use client";
// Apple-style pricing comparison table with test/live mode toggle
import { Fragment, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Minus, Loader2, Sparkles, FlaskConical, Zap, Copy, CheckCheck } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { CREDIT_PACKS, CreditPack } from "@/lib/credits";
import { Button } from "@/components/ui/button";

type PaymentMode = "test" | "live";

// ── Stripe checkout (passes mode to API) ────────────────────────────
async function startCheckout(packId: string, userId: string, mode: PaymentMode) {
  const res = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId, userId, mode }),
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

// ── Mode toggle ──────────────────────────────────────────────────────
function ModeToggle({
  mode,
  onChange,
}: {
  mode: PaymentMode;
  onChange: (m: PaymentMode) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCard = () => {
    navigator.clipboard.writeText("4242 4242 4242 4242");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle pill */}
      <div className="flex items-center gap-1 self-end rounded-full border border-border bg-secondary/60 p-1">
        <button
          onClick={() => onChange("test")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
            mode === "test"
              ? "bg-amber-400/90 text-amber-950 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FlaskConical className="size-3" />
          Demo
        </button>
        <button
          onClick={() => onChange("live")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
            mode === "live"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="size-3" />
          Live
        </button>
      </div>

      {/* Test card banner */}
      <AnimatePresence>
        {mode === "test" && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-300/50 bg-amber-50/80 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30">
              <div className="flex items-center gap-2">
                <FlaskConical className="size-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Demo mode — no real charges
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-1.5 dark:border-amber-700/40 dark:bg-amber-900/40">
                <span className="font-mono text-xs font-bold tracking-widest text-amber-900 dark:text-amber-200">
                  4242 4242 4242 4242
                </span>
                <button
                  onClick={copyCard}
                  className="text-amber-500 transition-colors hover:text-amber-700"
                >
                  {copied ? (
                    <CheckCheck className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Any future date · Any 3-digit CVC
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Pack header col ──────────────────────────────────────────────────
function PackHeaderCol({
  pack,
  popular,
  userId,
  mode,
}: {
  pack: CreditPack;
  popular: boolean;
  userId: string;
  mode: PaymentMode;
}) {
  const [loading, setLoading] = useState(false);
  const dollars = (pack.price / 100).toFixed(0);

  const handleBuy = async () => {
    setLoading(true);
    try { await startCheckout(pack.id, userId, mode); }
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

// ── Footer buy cell (own component so useState is not called inside map) ──
function FooterBuyCell({
  pack,
  popular,
  userId,
  mode,
  colClass,
}: {
  pack: CreditPack;
  popular: boolean;
  userId: string;
  mode: PaymentMode;
  colClass: string;
}) {
  const [loading, setLoading] = useState(false);
  const handleBuy = async () => {
    setLoading(true);
    try { await startCheckout(pack.id, userId, mode); }
    catch { setLoading(false); }
  };
  return (
    <td className={`border-t border-r border-border px-5 py-4 last:border-r-0 ${colClass}`}>
      <Button
        size="sm"
        variant={popular ? "default" : "outline"}
        className="w-full text-xs font-semibold"
        onClick={handleBuy}
        disabled={loading}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : `Get ${pack.name}`}
      </Button>
    </td>
  );
}

// ── Main table ───────────────────────────────────────────────────────
function PricingTable({ userId, mode }: { userId: string; mode: PaymentMode }) {
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
                <PackHeaderCol pack={pack} popular={i === popularIdx} userId={userId} mode={mode} />
              </th>
            ))}
          </tr>
        </thead>

        {/* Feature rows */}
        <tbody>
          {FEATURE_ROWS.map((row, rowIdx) => {
            const isLast = rowIdx === FEATURE_ROWS.length - 1;
            return (
              <Fragment key={row.label}>
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
              </Fragment>
            );
          })}
        </tbody>

        {/* Footer buy row */}
        <tfoot>
          <tr>
            <td className="border-t border-border px-5 py-4" />
            {CREDIT_PACKS.map((pack, i) => (
              <FooterBuyCell
                key={pack.id}
                pack={pack}
                popular={i === popularIdx}
                userId={userId}
                mode={mode}
                colClass={colBg(i)}
              />
            ))}
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
  const [mode, setMode] = useState<PaymentMode>("live");

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Buy Credits</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              One-time purchase. Credits never expire.
            </p>
          </div>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
        <PricingTable userId={userId} mode={mode} />
        <p className="text-center text-xs text-muted-foreground">
          Payments processed by{" "}
          <span className="font-medium text-foreground">Stripe</span>.
          {mode === "test" && " Demo mode — no real charges."}
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
          className="space-y-4"
        >
          <ModeToggle mode={mode} onChange={setMode} />
          <PricingTable userId={userId} mode={mode} />
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          Payments processed by{" "}
          <span className="font-medium text-foreground">Stripe</span>.
          {mode === "test" && " Demo mode — no real charges."}
        </p>
      </div>
    </section>
  );
}
