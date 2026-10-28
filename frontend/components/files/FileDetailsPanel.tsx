"use client";

import React, { useState } from "react";
import {
  X,
  Download,
  Share2,
  Trash2,
  Star,
  Tag as TagIcon,
  Plus,
  FileText,
  Clock,
  HardDrive,
  Shield,
  Layers,
} from "lucide-react";
import { FileItem, Tag } from "@/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";

interface FileDetailsPanelProps {
  file: FileItem | null;
  onClose: () => void;
  onRefresh: () => void;
  onShare: () => void;
  onVersions: () => void;
}

export function FileDetailsPanel({
  file,
  onClose,
  onRefresh,
  onShare,
  onVersions,
}: FileDetailsPanelProps) {
  const [newTag, setNewTag] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  if (!file) return null;

  const handleToggleStar = async () => {
    await api.toggleStar(file.id);
    onRefresh();
  };

  const handleDelete = async () => {
    if (confirm(`Move "${file.original_filename}" to trash?`)) {
      await api.deleteFile(file.id);
      onClose();
      onRefresh();
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    setIsAddingTag(true);
    try {
      const tag = await api.createTag(newTag.trim());
      const existingTagIds = file.tags?.map((t) => t.id) || [];
      if (!existingTagIds.includes(tag.id)) {
        await api.assignTags(file.id, [...existingTagIds, tag.id]);
      }
      setNewTag("");
      onRefresh();
    } catch {
      // Ignored
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const remaining = (file.tags || []).filter((t) => t.id !== tagId).map((t) => t.id);
    await api.assignTags(file.id, remaining);
    onRefresh();
  };

  return (
    <aside className="w-80 border-l border-border bg-card h-full flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
          File Details
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted-foreground hover:bg-accent"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
        {/* File Preview Thumbnail / Header */}
        <div className="flex flex-col items-center text-center p-4 bg-accent/20 rounded-xl border border-border">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
            <FileText className="w-6 h-6" />
          </div>
          <p className="font-bold text-sm text-foreground break-all" title={file.original_filename}>
            {file.original_filename}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatBytes(file.size_bytes)} • Version {file.current_version}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <a
              href={api.getFileDownloadUrl(file.id)}
              download={file.original_filename}
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onShare}
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleStar}
              className={`p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors ${
                file.is_starred ? "text-amber-500" : "text-muted-foreground"
              }`}
              title={file.is_starred ? "Starred" : "Star file"}
            >
              <Star className={`w-4 h-4 ${file.is_starred ? "fill-amber-500" : ""}`} />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg bg-secondary hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
            Properties
          </h4>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="text-muted-foreground">Type</div>
            <div className="text-foreground font-medium truncate">{file.mime_type || "Binary"}</div>

            <div className="text-muted-foreground">Size</div>
            <div className="text-foreground font-medium">{formatBytes(file.size_bytes)}</div>

            <div className="text-muted-foreground">Created</div>
            <div className="text-foreground font-medium">{formatDate(file.created_at)}</div>

            <div className="text-muted-foreground">Modified</div>
            <div className="text-foreground font-medium">{formatDate(file.updated_at || file.created_at)}</div>

            <div className="text-muted-foreground">Version</div>
            <div className="text-foreground font-medium flex items-center gap-1.5">
              v{file.current_version}
              <button
                onClick={onVersions}
                className="text-indigo-600 dark:text-indigo-400 hover:underline text-[10px]"
              >
                (History)
              </button>
            </div>
          </div>
        </div>

        {/* Checksum / Integrity */}
        {file.checksum && (
          <div className="p-3 rounded-lg border border-border bg-accent/10 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              SHA-256 Checksum
            </span>
            <p className="font-mono text-[10px] text-muted-foreground break-all select-all">
              {file.checksum}
            </p>
          </div>
        )}

        {/* Tags Section */}
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5" />
              Tags
            </span>
          </h4>

          <div className="flex flex-wrap gap-1.5">
            {file.tags && file.tags.length > 0 ? (
              file.tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium"
                >
                  #{t.name}
                  <button
                    onClick={() => handleRemoveTag(t.id)}
                    className="hover:text-red-500"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))
            ) : (
              <p className="text-[11px] text-muted-foreground">No tags attached.</p>
            )}
          </div>

          {/* Add tag input */}
          <form onSubmit={handleAddTag} className="flex gap-1.5 mt-2">
            <input
              type="text"
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="flex-1 bg-accent/40 border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={isAddingTag || !newTag.trim()}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
