"use client";

import { motion } from "framer-motion";
import {
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Monitor,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tips = [
  {
    icon: ShieldAlert,
    title: "Enable API Key Rotation",
    description:
      "Rotate your API keys regularly to minimize the risk of unauthorized access to your watermarking endpoints.",
    color: "text-chart-1",
    bg: "bg-chart-1/8",
  },
  {
    icon: KeyRound,
    title: "Use Strong Watermark Entropy",
    description:
      "Higher entropy settings produce more resilient watermarks that survive text transformations and paraphrasing.",
    color: "text-chart-2",
    bg: "bg-chart-2/8",
  },
  {
    icon: RefreshCw,
    title: "Schedule Regular Audits",
    description:
      "Set up automated audit scans for your published content to detect unauthorized reproductions early.",
    color: "text-chart-3",
    bg: "bg-chart-3/8",
  },
  {
    icon: Monitor,
    title: "Monitor Detection Logs",
    description:
      "Review your verification logs weekly to identify suspicious patterns or unusual detection rates.",
    color: "text-chart-4",
    bg: "bg-chart-4/8",
  },
];

export function ActionTipsCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.35 }}
    >
      <Card className="border-border/40 shadow-sm" id="tips">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Security Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {tips.map((tip) => {
              const Icon = tip.icon;
              return (
                <div
                  key={tip.title}
                  className="group rounded-xl bg-secondary/30 p-4 transition-colors duration-200 hover:bg-secondary/60"
                >
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <div className={`flex size-8 items-center justify-center rounded-lg ${tip.bg}`}>
                      <Icon className={`size-4 ${tip.color}`} />
                    </div>
                    <p className="text-[13px] font-semibold">{tip.title}</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {tip.description}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
