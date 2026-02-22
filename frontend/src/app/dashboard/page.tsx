"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ScanSearch,
  Fingerprint,
  Clock,
  BarChart3,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

import { OverviewTab } from "@/components/dashboard/tabs/OverviewTab";
import { WatermarkTab } from "@/components/dashboard/tabs/WatermarkTab";
import { VerifyTab } from "@/components/dashboard/tabs/VerifyTab";
import { HistoryTab } from "@/components/dashboard/tabs/HistoryTab";
import { AnalyticsTab } from "@/components/dashboard/tabs/AnalyticsTab";
import { SecurityTab } from "@/components/dashboard/tabs/SecurityTab";
import { BillingTab } from "@/components/dashboard/tabs/BillingTab";

// ── Tab definitions ─────────────────────────────────────────────────
const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "watermark", label: "Watermark", icon: Fingerprint },
  { id: "verify", label: "Verify", icon: ScanSearch },
  { id: "history", label: "History", icon: Clock },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "billing", label: "Billing", icon: CreditCard },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ── Dashboard Page ──────────────────────────────────────────────────
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Verify AI-generated content and monitor watermark activity.
        </p>
      </motion.div>

      {/* Tab bar */}
      <div className="relative">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-secondary/60 p-1.5 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="dashboard-tab-indicator"
                    className="absolute inset-0 rounded-xl bg-card shadow-sm"
                    style={{ zIndex: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 size-4" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })} 
        </div>
      </div>

      {/* Active tab content */}
      <div className="min-h-[60vh]">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "watermark" && <WatermarkTab onGoToBilling={() => setActiveTab("billing")} />}
        {activeTab === "verify" && <VerifyTab onGoToBilling={() => setActiveTab("billing")} />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "billing" && <BillingTab />}
      </div>
    </div>
  );
}
