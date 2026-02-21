"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { OverviewTab } from "@/components/dashboard/tabs/OverviewTab";
import { VerifyTab } from "@/components/dashboard/tabs/VerifyTab";
import { HistoryTab } from "@/components/dashboard/tabs/HistoryTab";
import { AnalyticsTab } from "@/components/dashboard/tabs/AnalyticsTab";
import { SecurityTab } from "@/components/dashboard/tabs/SecurityTab";

// ── Tab definitions ─────────────────────────────────────────────────
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "verify", label: "Verify" },
  { id: "history", label: "History" },
  { id: "analytics", label: "Analytics" },
  { id: "security", label: "Security" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ── Dashboard Page ──────────────────────────────────────────────────
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-6 overflow-x-auto border-b border-border/40 pb-px scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap pb-3 text-sm font-light transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="dashboard-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div className="min-h-[60vh]">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "verify" && <VerifyTab />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}
