"use client";

import { motion } from "framer-motion";
import { Download, MoreHorizontal, Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HistoryEntry {
  id: string;
  content: string;
  type: "text" | "file";
  found: boolean;
  confidence: number;
  model: string;
  timestamp: string;
}

interface RecentVerificationsTableProps {
  entries: HistoryEntry[];
  onExportCSV: () => void;
}

export function RecentVerificationsTable({
  entries,
  onExportCSV,
}: RecentVerificationsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
    >
      <Card className="border-border/40 shadow-sm" id="history">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px]">Recent Verifications</CardTitle>
            {entries.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 rounded-lg border-border/50 text-[12px]"
                    onClick={onExportCSV}
                  >
                    <Download className="size-3" />
                    Export CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download verification history</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary mb-3">
                <Eye className="size-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] font-medium text-muted-foreground">
                No verifications yet
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground/70">
                Results will appear here after you run a verification.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[12px] font-medium text-muted-foreground">
                      Time
                    </TableHead>
                    <TableHead className="text-[12px] font-medium text-muted-foreground">
                      Input
                    </TableHead>
                    <TableHead className="text-[12px] font-medium text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-[12px] font-medium text-muted-foreground">
                      Confidence
                    </TableHead>
                    <TableHead className="text-[12px] font-medium text-muted-foreground">
                      Model
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="group transition-colors hover:bg-secondary/40"
                    >
                      <TableCell className="text-[13px] text-muted-foreground">
                        {entry.timestamp}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="rounded-md px-1.5 py-0.5 text-[11px] font-normal"
                          >
                            {entry.type}
                          </Badge>
                          <span className="max-w-[180px] truncate text-[13px]">
                            {entry.content}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            entry.found
                              ? "bg-success/10 text-success hover:bg-success/15"
                              : "bg-destructive/10 text-destructive hover:bg-destructive/15"
                          }`}
                        >
                          {entry.found ? "Found" : "Not Found"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={`h-full rounded-full transition-all ${
                                entry.found ? "bg-success" : "bg-destructive"
                              }`}
                              style={{ width: `${entry.confidence}%` }}
                            />
                          </div>
                          <span className="text-[13px] font-medium">
                            {entry.confidence}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px]">{entry.model}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem className="text-[13px]">
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[13px]">
                              Copy Hash
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[13px] text-destructive">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {entries.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {Array.from({ length: Math.min(Math.ceil(entries.length / 5), 5) }).map(
                (_, i) => (
                  <button
                    key={i}
                    className={`size-2 rounded-full transition-colors ${
                      i === 0 ? "bg-primary" : "bg-border hover:bg-muted-foreground/50"
                    }`}
                  />
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
