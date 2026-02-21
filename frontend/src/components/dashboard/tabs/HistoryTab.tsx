"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  MoreHorizontal,
  Trash2,
  Search,
  FileText,
  Image,
  Music,
  Fingerprint,
  ScanSearch,
  Inbox,
  Film,
  FileType2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getHistory,
  removeEntry,
  clearHistory,
  type HistoryEntry,
} from "@/lib/store";

// ── Helpers ───────────────────────────────────────────────────────

const typeIcon = {
  text: FileText,
  image: Image,
  audio: Music,
  pdf: FileType2,
  video: Film,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Component ─────────────────────────────────────────────────────

export function HistoryTab() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(() => setEntries(getHistory()), []);

  useEffect(() => {
    load();
    window.addEventListener("lyra-history-change", load);
    return () => window.removeEventListener("lyra-history-change", load);
  }, [load]);

  const filtered = entries.filter((e) => {
    const matchesSearch =
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      e.model.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "watermark" && e.operation === "watermark") ||
      (filter === "verify" && e.operation === "verify") ||
      (filter === "found" && e.success) ||
      (filter === "notfound" && !e.success) ||
      (filter === "text" && e.dataType === "text") ||
      (filter === "image" && e.dataType === "image") ||
      (filter === "audio" && e.dataType === "audio") ||
      (filter === "pdf" && e.dataType === "pdf") ||
      (filter === "video" && e.dataType === "video");
    return matchesSearch && matchesFilter;
  });

  const exportCSV = () => {
    const header = "Time,Operation,Type,Status,Confidence,Model,Label\n";
    const rows = filtered
      .map(
        (e) =>
          `"${e.timestamp}","${e.operation}","${e.dataType}","${e.success ? "Success" : "Not Found"}",${e.confidence}%,"${e.model}","${e.label.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lyra-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    removeEntry(id);
    load();
  };

  const handleClear = () => {
    clearHistory();
    load();
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
            All watermark & verification operations.
          </p>
        </div>
        <div className="flex gap-2">
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs font-light text-destructive hover:text-destructive"
              onClick={handleClear}
            >
              <Trash2 className="size-3.5" />
              Clear All
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground"
            onClick={exportCSV}
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            placeholder="Search by content or model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl border-border/40 bg-card pl-9 text-sm font-light placeholder:text-muted-foreground/30"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-full rounded-xl border-border/40 bg-card text-sm font-light sm:w-40">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="watermark">Watermarks</SelectItem>
            <SelectItem value="verify">Verifications</SelectItem>
            <SelectItem value="found">Success / Found</SelectItem>
            <SelectItem value="notfound">Not Found</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          {entries.length === 0 ? (
            <>
              <Inbox className="mb-3 size-8 text-muted-foreground/20" />
              <p className="text-sm font-light text-muted-foreground">
                No history yet
              </p>
              <p className="mt-1 max-w-xs text-xs font-light text-muted-foreground/40">
                Watermark or verify content and it will appear here automatically.
              </p>
            </>
          ) : (
            <>
              <Search className="mb-3 size-6 text-muted-foreground/20" />
              <p className="text-sm font-light text-muted-foreground">
                No matching results
              </p>
              <p className="mt-1 text-xs font-light text-muted-foreground/40">
                Try adjusting your search or filters.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/30 rounded-2xl border border-border/50 bg-card">
          {/* Column headers */}
          <div className="hidden items-center gap-4 px-5 py-3 sm:flex">
            <span className="w-20 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">
              Time
            </span>
            <span className="w-20 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">
              Operation
            </span>
            <span className="flex-1 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">
              Content
            </span>
            <span className="w-16 text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">
              Status
            </span>
            <span className="w-20 text-right text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">
              Confidence
            </span>
            <span className="w-24 text-right text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground/50">
              Model
            </span>
            <span className="w-8" />
          </div>

          <AnimatePresence initial={false}>
            {filtered.map((entry, i) => {
              const Icon = typeIcon[entry.dataType] ?? FileText;
              const OpIcon =
                entry.operation === "watermark" ? Fingerprint : ScanSearch;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="group flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary/20 sm:flex-row sm:items-center sm:gap-4"
                >
                  {/* Time */}
                  <span className="w-20 shrink-0 text-xs font-light tabular-nums text-muted-foreground/50">
                    {relativeTime(entry.timestamp)}
                  </span>

                  {/* Operation */}
                  <div className="flex w-20 items-center gap-1.5">
                    <OpIcon className="size-3 text-muted-foreground/40" />
                    <span className="text-[11px] font-light capitalize text-muted-foreground">
                      {entry.operation}
                    </span>
                  </div>

                  {/* Content label */}
                  <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
                    <Icon className="size-3.5 shrink-0 text-muted-foreground/30" />
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[9px] font-normal uppercase"
                    >
                      {entry.dataType}
                    </Badge>
                    <span className="truncate text-[13px] font-light">
                      {entry.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex w-16 items-center gap-1.5">
                    <div
                      className={`size-1.5 rounded-full ${
                        entry.success ? "bg-emerald-500" : "bg-border"
                      }`}
                    />
                    <span className="text-xs font-light text-muted-foreground">
                      {entry.operation === "watermark"
                        ? "Done"
                        : entry.success
                          ? "Found"
                          : "None"}
                    </span>
                  </div>

                  {/* Confidence */}
                  <span className="w-20 text-right text-sm font-extralight tabular-nums">
                    {entry.confidence}%
                  </span>

                  {/* Model */}
                  <span className="w-24 truncate text-right text-xs font-light text-muted-foreground">
                    {entry.model}
                  </span>

                  {/* Actions */}
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
                        <DropdownMenuItem
                          className="gap-2 text-xs font-light"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              JSON.stringify(entry, null, 2)
                            );
                          }}
                        >
                          <Download className="size-3.5" />
                          Copy JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-xs font-light text-destructive"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div className="px-5 py-3">
            <p className="text-[11px] font-light text-muted-foreground/40">
              {filtered.length} of {entries.length} results
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
