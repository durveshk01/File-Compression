"use client";

import React, { useState } from "react";
import { FolderPlus, X } from "lucide-react";
import { api } from "@/lib/api";

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  onFolderCreated?: () => void;
}

export function NewFolderModal({
  isOpen,
  onClose,
  parentId,
  onFolderCreated,
}: NewFolderModalProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.createFolder(name.trim(), parentId);
      setName("");
      onClose();
      if (onFolderCreated) onFolderCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create folder.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Create New Folder</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Folder Name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Invoices, Project Assets"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-accent/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
            >
              {isLoading ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
