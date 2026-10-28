"use client";

import React, { useEffect, useState } from "react";
import {
  HardDrive,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  File,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/lib/api";
import { DashboardStats, StorageUsage, FileTypeStat } from "@/types";
import { formatBytes } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  document: "#3b82f6", // blue
  image: "#10b981",    // green
  video: "#f59e0b",    // amber
  audio: "#8b5cf6",    // purple
  archive: "#ec4899",  // pink
  code: "#06b6d4",     // cyan
  other: "#6b7280",    // gray
};

const CATEGORY_NAMES: Record<string, string> = {
  document: "Documents",
  image: "Images",
  video: "Videos",
  audio: "Audio",
  archive: "Archives",
  code: "Code & Text",
  other: "Other Files",
};

export default function StoragePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, usageData] = await Promise.all([
        api.getDashboardStats(),
        api.getStorageUsage(),
      ]);
      setStats(statsData);
      setUsage(usageData);
    } catch (err) {
      console.error("Failed to load storage data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const usedBytes = usage?.used_bytes ?? stats?.storage_used_bytes ?? 0;
  const quotaBytes = usage?.quota_bytes ?? stats?.storage_quota_bytes ?? 5 * 1024 * 1024 * 1024;
  const percentUsed = usage?.used_percentage ?? (quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0);
  const availableBytes = Math.max(0, quotaBytes - usedBytes);

  const distribution = stats?.file_type_distribution || [];

  const pieData = distribution
    .filter((d) => d.size_bytes > 0)
    .map((d) => ({
      name: CATEGORY_NAMES[d.category] || d.category,
      value: d.size_bytes,
      color: CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other,
      count: d.count,
    }));

  const barData = distribution.map((d) => ({
    name: CATEGORY_NAMES[d.category] || d.category,
    files: d.count,
    sizeMB: parseFloat((d.size_bytes / (1024 * 1024)).toFixed(2)),
  }));

  const getStatusColor = () => {
    if (percentUsed >= 90) return "text-red-600 dark:text-red-400";
    if (percentUsed >= 75) return "text-amber-600 dark:text-amber-400";
    return "text-indigo-600 dark:text-indigo-400";
  };

  const getProgressBarColor = () => {
    if (percentUsed >= 90) return "bg-red-600";
    if (percentUsed >= 75) return "bg-amber-500";
    return "bg-indigo-600";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "document":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-emerald-500" />;
      case "video":
        return <Film className="w-4 h-4 text-amber-500" />;
      case "audio":
        return <Music className="w-4 h-4 text-purple-500" />;
      case "archive":
        return <Archive className="w-4 h-4 text-pink-500" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HardDrive className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Storage Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your vault capacity, file distribution, and storage quotas.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted/50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Overview Hero Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
            <div>
              <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Total Storage
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-foreground">
                  {formatBytes(usedBytes)}
                </span>
                <span className="text-muted-foreground font-medium">
                  used of {formatBytes(quotaBytes)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(availableBytes)} free space remaining
              </p>
            </div>
            <div className="text-right">
              <span className={`text-4xl font-extrabold tracking-tight ${getStatusColor()}`}>
                {percentUsed.toFixed(1)}%
              </span>
              <p className="text-xs text-muted-foreground mt-1">Storage Quota Used</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressBarColor()}`}
                style={{ width: `${Math.min(100, Math.max(1, percentUsed))}%` }}
              />
            </div>
          </div>

          {percentUsed >= 80 && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>
                Your storage usage is above 80%. You may want to delete unnecessary files or empty your trash to free up space.
              </span>
            </div>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart: Storage by Category */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Storage by Category
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Distribution of disk space consumption across file types
            </p>

            <div className="h-64 w-full flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [formatBytes(val), "Size"]}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-12">
                  No storage data available yet.
                </div>
              )}
            </div>
          </div>

          {/* Bar Chart: File Counts by Category */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
            <h2 className="text-base font-semibold text-foreground mb-1">
              File Count by Category
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Number of files in each category stored in your vault
            </p>

            <div className="h-64 w-full flex items-center justify-center">
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val} files`, "Files"]}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="files" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-12">
                  No files uploaded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Category Breakdown
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-medium text-xs">
                  <th className="pb-3 pl-2">Category</th>
                  <th className="pb-3 text-right">Files</th>
                  <th className="pb-3 text-right">Size</th>
                  <th className="pb-3 text-right pr-2">% of Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {distribution.map((item) => {
                  const itemPercent = usedBytes > 0 ? (item.size_bytes / usedBytes) * 100 : 0;
                  return (
                    <tr key={item.category} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted"
                            style={{ color: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other }}
                          >
                            {getCategoryIcon(item.category)}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">
                              {CATEGORY_NAMES[item.category] || item.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right text-muted-foreground font-medium">
                        {item.count}
                      </td>
                      <td className="py-3 text-right text-foreground font-medium">
                        {formatBytes(item.size_bytes)}
                      </td>
                      <td className="py-3 text-right pr-2 text-muted-foreground">
                        {itemPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Storage Optimization Tips */}
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Optimizing Your Storage
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                CloudVault retains file version history so you can revert anytime. If you need to reclaim disk space, you can review previous versions on individual files, remove duplicate uploads, or permanently purge files from your Trash.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
