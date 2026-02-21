"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Search, TrendingUp, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

const stats = [
  {
    label: "Total Verifications",
    value: "1,284",
    change: "+12%",
    changeType: "positive" as const,
    icon: Search,
  },
  {
    label: "Watermarks Found",
    value: "847",
    change: "66%",
    changeType: "neutral" as const,
    icon: ShieldCheck,
  },
  {
    label: "Avg. Confidence",
    value: "94.2%",
    change: "+2.1%",
    changeType: "positive" as const,
    icon: TrendingUp,
  },
  {
    label: "Last Verified",
    value: "2m ago",
    change: "Active",
    changeType: "positive" as const,
    icon: Clock,
  },
];

export function StatsOverview() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="relative overflow-hidden border-border/40 p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-[13px] font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/8">
                  <Icon className="size-[18px] text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span
                  className={`text-[12px] font-medium ${
                    stat.changeType === "positive"
                      ? "text-success"
                      : "text-muted-foreground"
                  }`}
                >
                  {stat.change}
                </span>
                {stat.changeType === "positive" && (
                  <span className="text-[12px] text-muted-foreground">
                    vs last week
                  </span>
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
