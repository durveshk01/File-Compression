"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cloud,
  FolderOpen,
  Share2,
  Users,
  Clock,
  Star,
  Trash2,
  HardDrive,
  Activity,
  Settings,
  Shield,
  Layers,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { api } from "@/lib/api";
import { StorageUsage } from "@/types";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    api.getStorageUsage().then(setStorage).catch(() => {});
  }, [pathname]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: Layers },
    { label: "My Files", href: "/files", icon: FolderOpen },
    { label: "Shared with Me", href: "/shared", icon: Users },
    { label: "Shared by Me", href: "/shared-by-me", icon: Share2 },
    { label: "Recent", href: "/recent", icon: Clock },
    { label: "Starred", href: "/starred", icon: Star },
    { label: "Trash", href: "/trash", icon: Trash2 },
    { label: "Storage", href: "/storage", icon: HardDrive },
    { label: "Activity", href: "/activity", icon: Activity },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 flex flex-col h-full bg-card border-r border-border select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-border gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
          <Shield className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight text-foreground flex items-center gap-1.5">
            CloudVault
            <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-1.5 py-0.5 rounded">
              v1.0
            </span>
          </span>
          <span className="text-xs text-muted-foreground font-medium">Secure Cloud Drive</span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Storage Quota Widget */}
      <div className="p-4 border-t border-border bg-accent/20">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-foreground flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
            Storage
          </span>
          <span className="text-muted-foreground font-medium">
            {storage ? `${storage.used_percentage}%` : "0%"}
          </span>
        </div>

        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              (storage?.used_percentage || 0) > 90 ? "bg-red-500" : "bg-indigo-600"
            )}
            style={{ width: `${Math.min(100, storage?.used_percentage || 0)}%` }}
          />
        </div>

        <p className="text-[11px] text-muted-foreground font-medium">
          {storage
            ? `${formatBytes(storage.used_bytes)} of ${formatBytes(storage.quota_bytes)} used`
            : "Calculating quota..."}
        </p>
      </div>
    </aside>
  );
}
