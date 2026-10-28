"use client";

import React, { useEffect, useState } from "react";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  CheckSquare,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BulkActionsToolbar } from "@/components/files/BulkActionsToolbar";
import { api } from "@/lib/api";
import { FileItem } from "@/types";
import { formatBytes, formatDate } from "@/lib/utils";

export default function TrashPage() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadTrash = () => {
    setIsLoading(true);
    api.getTrashItems()
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (id: string) => {
    await api.restoreTrashItem(id);
    loadTrash();
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    if (confirm(`Permanently delete "${name}"? This file and all historical versions will be permanently purged.`)) {
      await api.permanentlyDeleteItem(id);
      loadTrash();
    }
  };

  const handleEmptyTrash = async () => {
    if (confirm("Are you sure you want to permanently empty the trash? All deleted items will be purged immediately.")) {
      await api.emptyTrash();
      setSelectedIds([]);
      loadTrash();
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Trash & Recovery</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Items in trash can be restored back to your vault or permanently purged.
            </p>
          </div>

          {items.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Empty Trash
            </button>
          )}
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Items in the trash still count towards your storage quota until permanently deleted.
          </span>
        </div>

        {/* Table of Trashed Items */}
        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            Loading trash items...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl bg-card">
            <Trash2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-sm text-foreground">Trash is empty</p>
            <p className="text-xs text-muted-foreground mt-1">
              Deleted files will appear here before being permanently removed.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-accent/20 text-muted-foreground text-[11px] uppercase font-semibold text-left">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === items.length && items.length > 0}
                      onChange={() => {
                        if (selectedIds.length === items.length) setSelectedIds([]);
                        else setSelectedIds(items.map((i) => i.id));
                      }}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Original Size</th>
                  <th className="py-3 px-3">Deleted Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-accent/40 transition-colors ${
                      selectedIds.includes(item.id) ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleSelect(item.id)}
                        className="rounded border-border"
                      />
                    </td>

                    <td className="py-3 px-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-xs">{item.original_filename}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-muted-foreground font-mono">
                      {formatBytes(item.size_bytes)}
                    </td>

                    <td className="py-3 px-3 text-muted-foreground">
                      {formatDate(item.trashed_at)}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRestore(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium flex items-center gap-1 text-[11px]"
                          title="Restore"
                        >
                          <RotateCcw className="w-3 h-3 text-indigo-500" />
                          Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item.id, item.original_filename)}
                          className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 font-medium flex items-center gap-1 text-[11px]"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-3 h-3" />
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BulkActionsToolbar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onRefresh={loadTrash}
        isTrashPage
      />
    </DashboardLayout>
  );
}
