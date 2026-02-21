"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart, Pie, Cell,
  AreaChart, Area,
  BarChart, Bar,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend,
} from "recharts";

// ── Data ──────────────────────────────────────────────────────────

const coverageData = [
  { name: "Watermarked", value: 847, fill: "var(--color-chart-1)" },
  { name: "Unverified", value: 312, fill: "var(--color-chart-3)" },
  { name: "No Watermark", value: 125, fill: "var(--color-chart-5)" },
];

const trendData = [
  { date: "Jan", total: 142, found: 98, missed: 44 },
  { date: "Feb", total: 198, found: 148, missed: 50 },
  { date: "Mar", total: 175, found: 132, missed: 43 },
  { date: "Apr", total: 234, found: 189, missed: 45 },
  { date: "May", total: 287, found: 241, missed: 46 },
  { date: "Jun", total: 248, found: 203, missed: 45 },
];

const modelData = [
  { model: "GPT-4o", detections: 312, confidence: 96 },
  { model: "Claude 3.5", detections: 248, confidence: 93 },
  { model: "Gemini Pro", detections: 156, confidence: 89 },
  { model: "Llama 3", detections: 89, confidence: 84 },
  { model: "Mistral", detections: 42, confidence: 78 },
];

const radialData = [
  { name: "Text", value: 92, fill: "var(--color-chart-1)" },
  { name: "Code", value: 87, fill: "var(--color-chart-2)" },
  { name: "Images", value: 64, fill: "var(--color-chart-3)" },
  { name: "Docs", value: 71, fill: "var(--color-chart-4)" },
];

const dailyData = [
  { day: "Mon", verified: 42, unverified: 8 },
  { day: "Tue", verified: 58, unverified: 12 },
  { day: "Wed", verified: 51, unverified: 9 },
  { day: "Thu", verified: 67, unverified: 14 },
  { day: "Fri", verified: 73, unverified: 11 },
  { day: "Sat", verified: 38, unverified: 6 },
  { day: "Sun", verified: 31, unverified: 5 },
];

// ── Configs ───────────────────────────────────────────────────────

const coverageConfig: ChartConfig = {
  watermarked: { label: "Watermarked", color: "var(--chart-1)" },
  unverified: { label: "Unverified", color: "var(--chart-3)" },
  none: { label: "No Watermark", color: "var(--chart-5)" },
};

const trendConfig: ChartConfig = {
  total: { label: "Total", color: "var(--chart-1)" },
  found: { label: "Found", color: "var(--chart-2)" },
};

const barConfig: ChartConfig = {
  verified: { label: "Verified", color: "var(--chart-1)" },
  unverified: { label: "Unverified", color: "var(--chart-5)" },
};

const radialConfig: ChartConfig = {
  text: { label: "Text", color: "var(--chart-1)" },
  code: { label: "Code", color: "var(--chart-2)" },
  images: { label: "Images", color: "var(--chart-3)" },
  docs: { label: "Docs", color: "var(--chart-4)" },
};

const modelConfig: ChartConfig = {
  detections: { label: "Detections", color: "var(--chart-1)" },
  confidence: { label: "Confidence", color: "var(--chart-4)" },
};

// ── Component ─────────────────────────────────────────────────────

const cardDelay = (i: number) => ({ duration: 0.35, delay: 0.08 * i, ease: [0.25, 0.1, 0.25, 1] as const });

export function AnalyticsTab() {
  const total = coverageData.reduce((s, d) => s + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Analytics</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Visual insights into your watermark verification data.
        </p>
      </div>

      {/* Row 1: Donut + Area */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* ── Donut ────────────────────────────────────── */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={cardDelay(0)}>
          <Card className="h-full border-border/40">
            <CardHeader className="pb-1">
              <CardTitle className="text-[14px]">Coverage Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pb-5">
              <ChartContainer config={coverageConfig} className="mx-auto aspect-square max-h-[200px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={coverageData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    strokeWidth={3}
                    stroke="var(--background)"
                    cornerRadius={4}
                    paddingAngle={2}
                  >
                    {coverageData.map((_, i) => (
                      <Cell key={i} fill={coverageData[i].fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
                {coverageData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full" style={{ background: d.fill.replace("color-", "") }} />
                    <span className="text-[11px] text-muted-foreground">
                      {d.name} ({Math.round((d.value / total) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Area chart ───────────────────────────────── */}
        <motion.div className="lg:col-span-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={cardDelay(1)}>
          <Card className="h-full border-border/40">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[14px]">Verification Trends</CardTitle>
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-normal">
                  Last 6 months
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer config={trendConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradFound" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="total" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#gradTotal)" dot={{ r: 3, fill: "var(--color-chart-1)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="found" stroke="var(--color-chart-2)" strokeWidth={2.5} fill="url(#gradFound)" dot={{ r: 3, fill: "var(--color-chart-2)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-2 flex items-center justify-center gap-5">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
                  <span className="text-[11px] text-muted-foreground">Total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} />
                  <span className="text-[11px] text-muted-foreground">Found</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Row 2: Bar + Radial */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Stacked bar ──────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={cardDelay(2)}>
          <Card className="border-border/40">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[14px]">Daily Activity</CardTitle>
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-normal">
                  This week
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer config={barConfig} className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 12, right: 8, left: -16, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="verified" stackId="a" fill="var(--color-chart-1)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="unverified" stackId="a" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-2 flex items-center justify-center gap-5">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
                  <span className="text-[11px] text-muted-foreground">Verified</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ background: "var(--chart-5)" }} />
                  <span className="text-[11px] text-muted-foreground">Unverified</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Radial bar ───────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={cardDelay(3)}>
          <Card className="border-border/40">
            <CardHeader className="pb-1">
              <CardTitle className="text-[14px]">Detection by Content Type</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer config={radialConfig} className="mx-auto aspect-square max-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="25%"
                    outerRadius="90%"
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                    barSize={12}
                  >
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <RadialBar
                      dataKey="value"
                      background={{ fill: "var(--secondary)" }}
                      cornerRadius={6}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                {radialData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full" style={{ background: d.fill.replace("color-", "") }} />
                    <span className="text-[11px] text-muted-foreground">{d.name} — {d.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Row 3: Model performance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={cardDelay(4)}>
        <Card className="border-border/40">
          <CardHeader className="pb-1">
            <CardTitle className="text-[14px]">Model Detection Performance</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ChartContainer config={modelConfig} className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="model" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={80} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="detections" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Confidence badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {modelData.map((m) => (
                <div key={m.model} className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-1.5">
                  <span className="text-[12px] font-medium">{m.model}</span>
                  <Badge
                    className={`rounded-full px-2 py-0 text-[10px] font-semibold ${
                      m.confidence >= 90
                        ? "bg-success/10 text-success"
                        : m.confidence >= 80
                          ? "bg-warning/10 text-warning"
                          : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {m.confidence}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
