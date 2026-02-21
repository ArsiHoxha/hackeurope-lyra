"use client";

import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNavbar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
        <DashboardFooter />
      </main>
    </div>
  );
}
