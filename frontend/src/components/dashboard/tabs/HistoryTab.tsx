"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, MoreHorizontal, Eye, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const demoHistory = [
  { id: "1", content: "API response: The transformer architecture uses…", type: "text" as const, found: true, confidence: 97, model: "GPT-4o", timestamp: "2026-02-21 14:32" },
  { id: "2", content: "Blog post about machine learning pipelines…", type: "text" as const, found: true, confidence: 91, model: "Claude 3.5", timestamp: "2026-02-21 14:15" },
  { id: "3", content: "sunset_landscape.png", type: "file" as const, found: false, confidence: 12, model: "—", timestamp: "2026-02-21 13:48" },
  { id: "4", content: "def quicksort(arr): if len(arr) <= 1…", type: "text" as const, found: true, confidence: 88, model: "Gemini Pro", timestamp: "2026-02-21 11:22" },
  { id: "5", content: "report_q4_2025.pdf", type: "file" as const, found: false, confidence: 8, model: "—", timestamp: "2026-02-21 09:05" },
  { id: "6", content: "The quantum computing paradigm shift…", type: "text" as const, found: true, confidence: 94, model: "GPT-4o", timestamp: "2026-02-20 22:41" },
  { id: "7", content: "async function fetchData() { const res…", type: "text" as const, found: true, confidence: 86, model: "Mistral Large", timestamp: "2026-02-20 19:15" },
  { id: "8", content: "Neural network architecture diagram.svg", type: "file" as const, found: true, confidence: 72, model: "Llama 3", timestamp: "2026-02-20 16:33" },
];

export function HistoryTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = demoHistory.filter((e) => {
    const matchesSearch =
      e.content.toLowerCase().includes(search.toLowerCase()) ||
      e.model.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "found" && e.found) ||
      (filter === "notfound" && !e.found) ||
      (filter === "text" && e.type === "text") ||
      (filter === "file" && e.type === "file");
    return matchesSearch && matchesFilter;
  });

  const exportCSV = () => {
    const header = "Time,Type,Status,Confidence,Model,Content\n";
    const rows = filtered
      .map(
        (e) =>
          `"${e.timestamp}","${e.type}","${e.found ? "Found" : "Not Found"}",${e.confidence}%,"${e.model}","${e.content.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verifications-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-light tracking-tight">History</h2>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            Browse and manage past verification results.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground"
          onClick={exportCSV}
        >
          <Download className="size-3.5" />
          Export
        </Button>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl border-border/40 bg-card pl-9 text-sm font-light placeholder:text-muted-foreground/30"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-full rounded-xl border-border/40 bg-card text-sm font-light sm:w-36">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="found">Watermark found</SelectItem>
            <SelectItem value="notfound">No watermark</SelectItem>
            <SelectItem value="text">Text only</SelectItem>
            <SelectItem value="file">Files only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <p className="text-sm font-light text-muted-foreground">No matching results</p>
          <p className="mt-1 text-xs font-light text-muted-foreground/40">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30 rounded-2xl border border-border/50 bg-card">
          {/* Column headers */}
          <div className="hidden items-center gap-4 px-5 py-3 sm:flex">
            <span className="w-20 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">Time</span>
            <span className="flex-1 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">Input</span>
            <span className="w-16 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">Status</span>
            <span className="w-20 text-right text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">Confidence</span>
            <span className="w-24 text-right text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">Model</span>
            <span className="w-8" />
          </div>

          {filtered.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="group flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary/20 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="w-20 shrink-0 text-xs font-light tabular-nums text-muted-foreground/50">
                {entry.timestamp.slice(11)}
              </span>
              <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
                <span className="text-[10px] font-light uppercase tracking-wider text-muted-foreground/40">
                  {entry.type}
                </span>
                <span className="truncate text-[13px] font-light">{entry.content}</span>
              </div>
              <div className="flex w-16 items-center gap-1.5">
                <div className={`size-1.5 rounded-full ${entry.found ? "bg-foreground" : "bg-border"}`} />
                <span className="text-xs font-light text-muted-foreground">
                  {entry.found ? "Found" : "None"}
                </span>
              </div>
              <span className="w-20 text-right text-sm font-extralight tabular-nums">
                {entry.confidence}%
              </span>
              <span className="w-24 text-right text-xs font-light text-muted-foreground">
                {entry.model}
              </span>
              <div className="w-8 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem className="gap-2 text-xs font-light">
                      <Eye className="size-3.5" />View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 text-xs font-light text-destructive">
                      <Trash2 className="size-3.5" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          ))}

          <div className="px-5 py-3">
            <p className="text-[11px] font-light text-muted-foreground/40">
              {filtered.length} of {demoHistory.length} results
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
