"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const stats: { label: string; value: string; change: string; trend: "up" | "down" | "neutral" }[] = [
  { label: "Total Verifications", value: "1,284", change: "+12.3%", trend: "up" },
  { label: "Watermarks Found", value: "847", change: "+8.1%", trend: "up" },
  { label: "Avg. Confidence", value: "94.2%", change: "+2.1%", trend: "up" },
  { label: "Last Verified", value: "2m ago", change: "Active", trend: "neutral" },
];

const activity = [
  { status: true, text: "API response watermark detected", conf: 97, time: "2 min ago" },
  { status: true, text: "Blog post verified", conf: 91, time: "15 min ago" },
  { status: false, text: "Uploaded image — no watermark", conf: 12, time: "1h ago" },
  { status: true, text: "Code snippet verified", conf: 88, time: "3h ago" },
  { status: false, text: "Manual text check — clean", conf: 8, time: "5h ago" },
];

const breakdown = [
  { label: "Text content", pct: 62 },
  { label: "Code snippets", pct: 24 },
  { label: "Image files", pct: 9 },
  { label: "Documents", pct: 5 },
];

export function OverviewTab() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-light tracking-tight">Welcome back, Alex</h2>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          Here&apos;s a summary of your watermark verification activity.
        </p>
      </div>

      {/* Stats — single card with dividers, like Apple's spec grid */}
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border/50 bg-border/50 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card p-6"
          >
            <p className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-extralight tracking-tight">
              {stat.value}
            </p>
            <div className="mt-3 flex items-center gap-1">
              {stat.trend === "up" && <ArrowUpRight className="size-3 text-muted-foreground" />}
              {stat.trend === "down" && <ArrowDownRight className="size-3 text-muted-foreground" />}
              <span className="text-[11px] font-light text-muted-foreground">
                {stat.change}
                {stat.trend !== "neutral" && " vs last week"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Content row */}
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Activity */}
        <div className="lg:col-span-3">
          <h3 className="mb-4 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground">
            Recent Activity
          </h3>
          <div className="divide-y divide-border/30 rounded-2xl border border-border/50 bg-card">
            {activity.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.04 }}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/20"
              >
                <div
                  className={`size-1.5 shrink-0 rounded-full ${
                    item.status ? "bg-foreground" : "bg-border"
                  }`}
                />
                <p className="flex-1 truncate text-[13px] font-light">{item.text}</p>
                <span className="shrink-0 text-xs font-light tabular-nums text-muted-foreground">
                  {item.conf}%
                </span>
                <span className="shrink-0 text-[11px] font-light text-muted-foreground/40">
                  {item.time}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Breakdown */}
        <div className="lg:col-span-2">
          <h3 className="mb-4 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground">
            Detection Breakdown
          </h3>
          <div className="space-y-6 rounded-2xl border border-border/50 bg-card p-6">
            {breakdown.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.06 }}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[13px] font-light">{item.label}</span>
                  <span className="text-xs font-light tabular-nums text-muted-foreground">
                    {item.pct}%
                  </span>
                </div>
                <div className="h-[2px] overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full bg-foreground/70"
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.35 + i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
