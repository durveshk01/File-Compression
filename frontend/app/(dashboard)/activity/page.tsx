"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  Upload,
  Download,
  Trash2,
  RotateCcw,
  Share2,
  Edit,
  FolderPlus,
  Star,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/lib/api";
import { ActivityLog } from "@/types";
import { formatDate } from "@/lib/utils";

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const data = await api.getActivity(100);
      setActivities(data);
    } catch (err) {
      console.error("Failed to load activities", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("upload")) {
      return <Upload className="w-4 h-4 text-emerald-500" />;
    }
    if (act.includes("download")) {
      return <Download className="w-4 h-4 text-blue-500" />;
    }
    if (act.includes("trash") || act.includes("delete")) {
      return <Trash2 className="w-4 h-4 text-red-500" />;
    }
    if (act.includes("restore")) {
      return <RotateCcw className="w-4 h-4 text-teal-500" />;
    }
    if (act.includes("share")) {
      return <Share2 className="w-4 h-4 text-purple-500" />;
    }
    if (act.includes("rename") || act.includes("move") || act.includes("update")) {
      return <Edit className="w-4 h-4 text-amber-500" />;
    }
    if (act.includes("folder")) {
      return <FolderPlus className="w-4 h-4 text-indigo-500" />;
    }
    if (act.includes("star")) {
      return <Star className="w-4 h-4 text-yellow-500" />;
    }
    return <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  const formatActionTitle = (action: string): string => {
    const formatted = action.replace(/_/g, " ");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const filteredActivities = activities.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      (item.resource_name && item.resource_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      actionFilter === "all" ||
      item.action.toLowerCase().includes(actionFilter.toLowerCase());

    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Activity Log
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Audit trail of actions, uploads, sharing events, and file modifications.
            </p>
          </div>
          <button
            onClick={loadActivities}
            disabled={isLoading}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted/50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by resource or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-auto"
            >
              <option value="all">All Actions</option>
              <option value="upload">Uploads</option>
              <option value="download">Downloads</option>
              <option value="share">Sharing</option>
              <option value="delete">Deletions</option>
              <option value="restore">Restorations</option>
              <option value="star">Favorites</option>
            </select>
          </div>
        </div>

        {/* Activity Timeline List */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-4 sm:p-5 flex items-start gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 border border-border/50">
                    {getActionIcon(act.action)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {formatActionTitle(act.action)}
                      </span>
                      {act.resource_type && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                          {act.resource_type}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-foreground/80 mt-0.5 truncate">
                      {act.resource_name ? (
                        <span className="font-medium text-foreground">{act.resource_name}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Resource ID: {act.resource_id || "N/A"}</span>
                      )}
                    </p>

                    {act.details && Object.keys(act.details).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/40 font-mono">
                        {JSON.stringify(act.details)}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(act.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">No activity recorded yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Actions you perform like uploading files, creating folders, or sharing items will appear here in chronological order.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
