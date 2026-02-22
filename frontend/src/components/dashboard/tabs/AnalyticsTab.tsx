"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";
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
} from "recharts";
import { getHistory, type HistoryEntry } from "@/lib/store";

// ── Configs ───────────────────────────────────────────────────────

const coverageConfig: ChartConfig = {
  watermarked: { label: "Watermarked", color: "var(--chart-1)" },
  verified: { label: "Verified", color: "var(--chart-3)" },
  notfound: { label: "Not Found", color: "var(--chart-5)" },
};

const trendConfig: ChartConfig = {
  total: { label: "Total", color: "var(--chart-1)" },
  success: { label: "Success", color: "var(--chart-2)" },
};

const barConfig: ChartConfig = {
  watermark: { label: "Watermark", color: "var(--chart-1)" },
  verify: { label: "Verify", color: "var(--chart-4)" },
};

const radialConfig: ChartConfig = {
  text: { label: "Text", color: "var(--chart-1)" },
  image: { label: "Image", color: "var(--chart-2)" },
  audio: { label: "Audio", color: "var(--chart-3)" },
  pdf: { label: "PDF", color: "var(--chart-4)" },
  video: { label: "Video", color: "var(--chart-5)" },
};

const modelConfig: ChartConfig = {
  count: { label: "Operations", color: "var(--chart-1)" },
};

// ── Compute analytics from real history ───────────────────────────

function buildAnalytics(entries: HistoryEntry[]) {
  // Coverage donut
  const watermarkOps = entries.filter((e) => e.operation === "watermark").length;
  const verifyFound = entries.filter((e) => e.operation === "verify" && e.success).length;
  const verifyNotFound = entries.filter((e) => e.operation === "verify" && !e.success).length;
  const coverageData = [
    { name: "Watermarked", value: watermarkOps, fill: "var(--color-chart-1)" },
    { name: "Verified ✓", value: verifyFound, fill: "var(--color-chart-3)" },
    { name: "Not Found", value: verifyNotFound, fill: "var(--color-chart-5)" },
  ].filter((d) => d.value > 0);

  // Trend: group by day (last 14 days)
  const dayMap = new Map<string, { total: number; success: number }>();
  for (const e of entries) {
    const day = e.timestamp.slice(0, 10);
    const cur = dayMap.get(day) ?? { total: 0, success: 0 };
    cur.total++;
    if (e.success) cur.success++;
    dayMap.set(day, cur);
  }
  const trendData = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, d]) => ({
      date: date.slice(5), // MM-DD
      total: d.total,
      success: d.success,
    }));

  // Daily bar: group by weekday
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekBuckets: Record<string, { watermark: number; verify: number }> = {};
  for (const d of dayOfWeek) weekBuckets[d] = { watermark: 0, verify: 0 };
  for (const e of entries) {
    const dow = dayOfWeek[new Date(e.timestamp).getDay()];
    if (e.operation === "watermark") weekBuckets[dow].watermark++;
    else weekBuckets[dow].verify++;
  }
  const dailyData = dayOfWeek.map((day) => ({
    day,
    watermark: weekBuckets[day].watermark,
    verify: weekBuckets[day].verify,
  }));

  // Content type radial
  const typeCounts: Record<string, number> = { text: 0, image: 0, audio: 0, pdf: 0, video: 0 };
  for (const e of entries) typeCounts[e.dataType] = (typeCounts[e.dataType] ?? 0) + 1;
  const maxType = Math.max(...Object.values(typeCounts), 1);
  const radialData = [
    { name: "Text", value: Math.round((typeCounts.text / maxType) * 100), fill: "var(--color-chart-1)" },
    { name: "Image", value: Math.round((typeCounts.image / maxType) * 100), fill: "var(--color-chart-2)" },
    { name: "Audio", value: Math.round((typeCounts.audio / maxType) * 100), fill: "var(--color-chart-3)" },
    { name: "PDF", value: Math.round((typeCounts.pdf / maxType) * 100), fill: "var(--color-chart-4)" },
    { name: "Video", value: Math.round((typeCounts.video / maxType) * 100), fill: "var(--color-chart-5)" },
  ].filter((d) => d.value > 0);

  // Model performance
  const modelMap = new Map<string, { count: number; confSum: number }>();
  for (const e of entries) {
    const m = e.model || "Unknown";
    const cur = modelMap.get(m) ?? { count: 0, confSum: 0 };
    cur.count++;
    cur.confSum += e.confidence;
    modelMap.set(m, cur);
  }
  const modelData = [...modelMap.entries()]
    .map(([model, d]) => ({
      model,
      count: d.count,
      avgConf: Math.round(d.confSum / d.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { coverageData, trendData, dailyData, radialData, modelData };
}

// ── Component ─────────────────────────────────────────────────────

const cardDelay = (i: number) => ({ duration: 0.35, delay: 0.08 * i, ease: [0.25, 0.1, 0.25, 1] as const });

export function AnalyticsTab() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const load = useCallback(() => setEntries(getHistory()), []);

  useEffect(() => {
    load();
    window.addEventListener("attestify-history-change", load);
    return () => window.removeEventListener("attestify-history-change", load);
  }, [load]);

  const { coverageData, trendData, dailyData, radialData, modelData } = useMemo(
    () => buildAnalytics(entries),
    [entries]
  );

  const total = coverageData.reduce((s, d) => s + d.value, 0);

  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center py-32 text-center"
      >
        <Inbox className="mb-3 size-8 text-muted-foreground/20" />
        <p className="text-sm font-light text-muted-foreground">
          No data yet
        </p>
        <p className="mt-1 max-w-xs text-xs font-light text-muted-foreground/40">
          Watermark or verify content to see analytics here.
        </p>
      </motion.div>
    );
  }

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
                    {coverageData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
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
                      {d.name} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
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
                <CardTitle className="text-[14px]">Activity Trends</CardTitle>
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-normal">
                  Last 14 days
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {trendData.length > 0 ? (
                <>
                  <ChartContainer config={trendConfig} className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="total" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#gradTotal)" dot={{ r: 3, fill: "var(--color-chart-1)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                        <Area type="monotone" dataKey="success" stroke="var(--color-chart-2)" strokeWidth={2.5} fill="url(#gradSuccess)" dot={{ r: 3, fill: "var(--color-chart-2)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
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
                      <span className="text-[11px] text-muted-foreground">Success</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground/40">
                  No trend data yet
                </div>
              )}
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
                <CardTitle className="text-[14px]">Weekly Activity</CardTitle>
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-normal">
                  By day
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
                    <Bar dataKey="watermark" stackId="a" fill="var(--color-chart-1)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="verify" stackId="a" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-2 flex items-center justify-center gap-5">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
                  <span className="text-[11px] text-muted-foreground">Watermark</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ background: "var(--chart-4)" }} />
                  <span className="text-[11px] text-muted-foreground">Verify</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Radial bar ───────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={cardDelay(3)}>
          <Card className="border-border/40">
            <CardHeader className="pb-1">
              <CardTitle className="text-[14px]">Content Type Distribution</CardTitle>
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
      {modelData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={cardDelay(4)}>
          <Card className="border-border/40">
            <CardHeader className="pb-1">
              <CardTitle className="text-[14px]">Model Usage</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer config={modelConfig} className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="model" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={80} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* Avg confidence badges */}
              <div className="mt-4 flex flex-wrap gap-2">
                {modelData.map((m) => (
                  <div key={m.model} className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-1.5">
                    <span className="text-[12px] font-medium">{m.model}</span>
                    <Badge
                      className={`rounded-full px-2 py-0 text-[10px] font-semibold ${m.avgConf >= 90
                        ? "bg-emerald-500/10 text-emerald-500"
                        : m.avgConf >= 70
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-red-500/10 text-red-500"
                        }`}
                    >
                      avg {m.avgConf}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}