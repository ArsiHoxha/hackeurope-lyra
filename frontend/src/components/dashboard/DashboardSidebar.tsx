"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  History,
  BarChart3,
  Settings,
  FileSearch,
  Lightbulb,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const sidebarItems = [
  {
    label: "Verify",
    href: "/dashboard",
    icon: ShieldCheck,
  },
  {
    label: "History",
    href: "/dashboard#history",
    icon: History,
  },
  {
    label: "Analytics",
    href: "/dashboard#analytics",
    icon: BarChart3,
  },
  {
    label: "Forensics",
    href: "/dashboard#forensics",
    icon: FileSearch,
  },
  {
    label: "Tips",
    href: "/dashboard#tips",
    icon: Lightbulb,
  },
];

const bottomItems = [
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-14 hidden h-[calc(100vh-3.5rem)] flex-col border-r border-border/40 bg-background transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] lg:flex",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      <div className="flex flex-1 flex-col gap-1 p-2 pt-4">
        {sidebarItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href.split("#")[0]);
          const Icon = item.icon;

          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/8 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={cn("size-[18px] shrink-0", isActive && "text-primary")} />
              {!collapsed && (
                <motion.span
                  initial={false}
                  animate={{ opacity: 1, width: "auto" }}
                  className="truncate"
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.href}>{linkContent}</div>;
        })}
      </div>

      {/* Bottom items */}
      <div className="border-t border-border/40 p-2">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.href}>{content}</div>;
        })}

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "mt-1 w-full gap-2 text-[13px] text-muted-foreground",
            collapsed && "px-2"
          )}
        >
          <ChevronLeft
            className={cn(
              "size-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
