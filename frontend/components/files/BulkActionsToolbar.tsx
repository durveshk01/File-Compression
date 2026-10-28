"use client";

import React from "react";
import { X, Trash2, Star, RotateCcw, CheckSquare } from "lucide-react";
import { api } from "@/lib/api";

interface BulkActionsToolbarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
  isTrashPage?: boolean;
}

export function BulkActionsToolbar({
  selectedIds,
  onClearSelection,
  onRefresh,
  isTrashPage = false,
}: BulkActionsToolbarProps) {
  if (selectedIds.length === 0) return null;

  const handleBulkDelete = async () => {
    if (confirm(`Move ${selectedIds.length} selected files to trash?`)) {
      await api.bulkAction(selectedIds, "delete");
      onClearSelection();
      onRefresh();
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (confirm(`Permanently delete ${selectedIds.length} files? This cannot be undone.`)) {
      await api.bulkAction(selectedIds, "permanent_delete");
      onClearSelection();
      onRefresh();
    }
  };

  const handleBulkRestore = async () => {
    await api.bulkAction(selectedIds, "restore");
    onClearSelection();
    onRefresh();
  };

  const handleBulkStar = async () => {
    await api.bulkAction(selectedIds, "star");
    onClearSelection();
    onRefresh();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 text-xs animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-2 pr-2 border-r border-border font-semibold text-foreground">
        <CheckSquare className="w-4 h-4 text-indigo-600" />
        <span>{selectedIds.length} selected</span>
      </div>

      <div className="flex items-center gap-2">
        {!isTrashPage ? (
          <>
            <button
              onClick={handleBulkStar}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium flex items-center gap-1.5 transition-colors"
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Star
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleBulkRestore}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
              Restore
            </button>
            <button
              onClick={handleBulkPermanentDelete}
              className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Permanently
            </button>
          </>
        )}
      </div>

      <button
        onClick={onClearSelection}
        className="p-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Deselect all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
