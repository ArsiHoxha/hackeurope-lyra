"use client";

import { motion } from "framer-motion";
import {
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Monitor,
  Lock,
  Eye,
  Server,
  Bell,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const tips = [
  {
    icon: ShieldAlert,
    title: "Enable API Key Rotation",
    description: "Rotate your API keys regularly to minimize the risk of unauthorized access to your watermarking endpoints.",
    severity: "high" as const,
    color: "var(--chart-5)",
  },
  {
    icon: KeyRound,
    title: "Use Strong Watermark Entropy",
    description: "Higher entropy settings produce more resilient watermarks that survive text transformations and paraphrasing.",
    severity: "medium" as const,
    color: "var(--chart-3)",
  },
  {
    icon: RefreshCw,
    title: "Schedule Regular Audits",
    description: "Set up automated audit scans for your published content to detect unauthorized reproductions early.",
    severity: "medium" as const,
    color: "var(--chart-1)",
  },
  {
    icon: Monitor,
    title: "Monitor Detection Logs",
    description: "Review your verification logs weekly to identify suspicious patterns or unusual detection rates.",
    severity: "low" as const,
    color: "var(--chart-2)",
  },
  {
    icon: Lock,
    title: "Enable Two-Factor Authentication",
    description: "Add an extra layer of security to your dashboard access with SMS or authenticator app verification.",
    severity: "high" as const,
    color: "var(--chart-4)",
  },
  {
    icon: Server,
    title: "Configure Webhook Alerts",
    description: "Set up real-time webhooks to get notified when watermark violations or anomalies are detected.",
    severity: "low" as const,
    color: "var(--chart-1)",
  },
];

const securityScore = 78;

const checklistItems = [
  { label: "API keys rotated this month", done: true },
  { label: "Two-factor authentication", done: false },
  { label: "Webhook alerts configured", done: true },
  { label: "Audit scan scheduled", done: false },
  { label: "Strong entropy enabled", done: true },
];

export function SecurityTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Security</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Recommendations and tools to strengthen your watermark security posture.
        </p>
      </div>

      {/* Top row: Score + Checklist */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Score card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <Card className="flex h-full flex-col items-center justify-center border-border/40 p-6 text-center">
            <div className="relative">
              <svg className="size-32" viewBox="0 0 128 128">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke={securityScore >= 80 ? "var(--success)" : securityScore >= 60 ? "var(--warning)" : "var(--destructive)"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - securityScore / 100) }}
                  transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
                  transform="rotate(-90 64 64)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight">{securityScore}</span>
                <span className="text-[11px] font-medium text-muted-foreground">out of 100</span>
              </div>
            </div>
            <p className="mt-4 text-[14px] font-semibold">Security Score</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Good — complete 2 more items to improve.
            </p>
          </Card>
        </motion.div>

        {/* Checklist */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <Card className="h-full border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]">Security Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklistItems.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className="flex items-center gap-3 rounded-xl bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary/50"
                >
                  <div className={`flex size-6 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-success/15" : "bg-muted"}`}>
                    {item.done ? (
                      <svg className="size-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <div className="size-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className={`flex-1 text-[13px] ${item.done ? "text-muted-foreground line-through" : "font-medium"}`}>
                    {item.label}
                  </span>
                  {!item.done && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2.5 text-[11px] text-primary">
                      Fix <ArrowRight className="size-3" />
                    </Button>
                  )}
                </motion.div>
              ))}

              <div className="mt-2 pt-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Overall progress</span>
                  <span className="text-[12px] font-semibold">
                    {checklistItems.filter((c) => c.done).length}/{checklistItems.length}
                  </span>
                </div>
                <Progress
                  value={(checklistItems.filter((c) => c.done).length / checklistItems.length) * 100}
                  className="h-1.5"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recommendations grid */}
      <div>
        <h3 className="mb-4 text-[14px] font-semibold">Recommendations</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tips.map((tip, i) => {
            const Icon = tip.icon;
            return (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.06 }}
              >
                <Card className="group h-full border-border/40 transition-all duration-300 hover:shadow-md hover:shadow-primary/5">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div
                        className="flex size-10 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                        style={{ background: `color-mix(in srgb, ${tip.color} 12%, transparent)` }}
                      >
                        <Icon className="size-5" style={{ color: tip.color }} />
                      </div>
                      <Badge
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          tip.severity === "high"
                            ? "bg-destructive/10 text-destructive"
                            : tip.severity === "medium"
                              ? "bg-warning/10 text-warning"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tip.severity}
                      </Badge>
                    </div>
                    <p className="text-[13px] font-semibold">{tip.title}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      {tip.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
