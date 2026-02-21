"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// Pie chart data
const coverageData = [
  { name: "Watermarked", value: 847, fill: "var(--color-chart-1)" },
  { name: "No Watermark", value: 437, fill: "var(--color-chart-3)" },
];

const coverageConfig: ChartConfig = {
  watermarked: { label: "Watermarked", color: "var(--chart-1)" },
  noWatermark: { label: "No Watermark", color: "var(--chart-3)" },
};

// Line chart data
const trendData = [
  { date: "Mon", verifications: 24, found: 18 },
  { date: "Tue", verifications: 38, found: 29 },
  { date: "Wed", verifications: 31, found: 22 },
  { date: "Thu", verifications: 45, found: 34 },
  { date: "Fri", verifications: 52, found: 41 },
  { date: "Sat", verifications: 29, found: 20 },
  { date: "Sun", verifications: 36, found: 27 },
];

const trendConfig: ChartConfig = {
  verifications: { label: "Verifications", color: "var(--chart-1)" },
  found: { label: "Found", color: "var(--chart-2)" },
};

export function AnalyticsPanel() {
  const total = coverageData.reduce((s, d) => s + d.value, 0);
  const percentage = Math.round((coverageData[0].value / total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      <div className="grid gap-4 lg:grid-cols-2" id="analytics">
        {/* Pie chart */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Watermark Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={coverageConfig} className="mx-auto aspect-square max-h-[220px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={coverageData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  strokeWidth={2}
                  stroke="var(--background)"
                >
                  {coverageData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-2 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ background: "var(--chart-1)" }} />
                <span className="text-[12px] text-muted-foreground">
                  Watermarked ({percentage}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ background: "var(--chart-3)" }} />
                <span className="text-[12px] text-muted-foreground">
                  None ({100 - percentage}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Area chart */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Verification Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillVerifications" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillFound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="verifications"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#fillVerifications)"
                  />
                  <Area
                    type="monotone"
                    dataKey="found"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    fill="url(#fillFound)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="mt-2 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ background: "var(--chart-1)" }} />
                <span className="text-[12px] text-muted-foreground">Total</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ background: "var(--chart-2)" }} />
                <span className="text-[12px] text-muted-foreground">Found</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
