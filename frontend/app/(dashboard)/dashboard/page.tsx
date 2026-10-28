"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Folder,
  HardDrive,
  Share2,
  Star,
  Upload,
  ArrowRight,
  TrendingUp,
  Clock,
  Shield,
  Layers,
  Activity as ActivityIcon,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileCard } from "@/components/files/FileCard";
import { FilePreviewModal } from "@/components/modals/FilePreviewModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { VersionHistoryModal } from "@/components/modals/VersionHistoryModal";
import { FileDetailsPanel } from "@/components/files/FileDetailsPanel";
import { api } from "@/lib/api";
import { DashboardStats, FileItem } from "@/types";
import { formatBytes, formatDate } from "@/lib/utils";

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b"];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileItem | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileItem | null>(null);

  const loadDashboard = () => {
    setIsLoading(true);
    api.getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDashboard();
    window.addEventListener("refresh_files", loadDashboard);
    return () => window.removeEventListener("refresh_files", loadDashboard);
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Loading dashboard analytics...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const chartData = (stats?.file_type_distribution || []).map((item) => ({
    name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
    value: item.size_bytes,
    count: item.count,
  }));

  const availableBytes = stats
    ? Math.max(0, stats.storage_quota_bytes - stats.storage_used_bytes)
    : 0;

  const usedPercentage = stats
    ? Math.min(100, (stats.storage_used_bytes / stats.storage_quota_bytes) * 100).toFixed(1)
    : "0";

  return (
    <DashboardLayout>
      <div className="flex h-full">
        <div className="flex-1 space-y-8 overflow-y-auto pr-2">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Dashboard Overview
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time usage analytics, quick access files, and storage health.
              </p>
            </div>
            <Link
              href="/files"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
            >
              Browse All Files
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Total Files</span>
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats?.total_files ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Across {stats?.total_folders ?? 0} folders
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Storage Used</span>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatBytes(stats?.storage_used_bytes || 0)}
              </p>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${usedPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {usedPercentage}% of {formatBytes(stats?.storage_quota_bytes || 0)}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Shared Files</span>
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
                  <Share2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats?.shared_files_count ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Active permissions & links
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Starred Files</span>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                  <Star className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats?.starred_files_count ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Marked as favorites
              </p>
            </div>
          </div>

          {/* Storage Distribution & Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Storage Chart */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 lg:col-span-1">
              <h3 className="font-semibold text-sm text-foreground">
                Storage Breakdown
              </h3>
              <div className="h-56 relative flex items-center justify-center">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => formatBytes(val)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-muted-foreground text-center">
                    No files stored yet.
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                {chartData.map((d, i) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-foreground">{d.name}</span>
                    </div>
                    <span className="text-muted-foreground font-mono">
                      {formatBytes(d.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activities Feed */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4 lg:col-span-2 flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <ActivityIcon className="w-4 h-4 text-indigo-500" />
                  Recent Activity
                </h3>
                <Link
                  href="/activity"
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  View full log
                </Link>
              </div>

              <div className="divide-y divide-border flex-1 overflow-y-auto">
                {!stats?.recent_activities || stats.recent_activities.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No recent activity records.
                  </div>
                ) : (
                  stats.recent_activities.map((a) => (
                    <div
                      key={a.id}
                      className="py-3 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">
                          {a.action.replace(/_/g, " ").toUpperCase()}
                        </p>
                        <p className="text-muted-foreground">
                          {a.resource_name || a.resource_type || "Resource"}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(a.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Files Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">
                Recent Files
              </h3>
              <Link
                href="/files"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                View all files
              </Link>
            </div>

            {!stats?.recent_files || stats.recent_files.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl bg-card">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm text-foreground">No files in your vault yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Upload your first document, photo, or project to get started.
                </p>
                <Link
                  href="/files"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload First File
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {stats.recent_files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    isSelected={detailsFile?.id === file.id}
                    onSelect={() => setDetailsFile(file)}
                    onPreview={() => setPreviewFile(file)}
                    onShare={() => setShareFile(file)}
                    onVersions={() => setVersionsFile(file)}
                    onDetails={() => setDetailsFile(file)}
                    onRefresh={loadDashboard}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Details Panel Sidebar */}
        {detailsFile && (
          <FileDetailsPanel
            file={detailsFile}
            onClose={() => setDetailsFile(null)}
            onRefresh={loadDashboard}
            onShare={() => setShareFile(detailsFile)}
            onVersions={() => setVersionsFile(detailsFile)}
          />
        )}
      </div>

      {/* Modals */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
      <ShareModal
        file={shareFile}
        isOpen={!!shareFile}
        onClose={() => setShareFile(null)}
      />
      <VersionHistoryModal
        file={versionsFile}
        isOpen={!!versionsFile}
        onClose={() => setVersionsFile(null)}
        onVersionRestored={loadDashboard}
      />
    </DashboardLayout>
  );
}
