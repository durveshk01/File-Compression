"use client";

import React, { useEffect, useState } from "react";
import { Users, Download, Eye, FileText, Calendar, Shield } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilePreviewModal } from "@/components/modals/FilePreviewModal";
import { api } from "@/lib/api";
import { FileItem, FileShare } from "@/types";
import { formatBytes, formatDate } from "@/lib/utils";

export default function SharedWithMePage() {
  const [shares, setShares] = useState<FileShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const loadShares = () => {
    setIsLoading(true);
    api.getSharedWithMe()
      .then(setShares)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadShares();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Shared with Me</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Files that other users have granted you access to view or edit.
          </p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            Loading shared files...
          </div>
        ) : shares.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl bg-card">
            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold text-sm text-foreground">No files shared with you</p>
            <p className="text-xs text-muted-foreground mt-1">
              When colleagues or teammates share files with your email, they'll show up here.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-accent/20 text-muted-foreground text-[11px] uppercase font-semibold text-left">
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Shared By</th>
                  <th className="py-3 px-4">Permission</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Date Shared</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shares.map((share) => {
                  const file = share.file;
                  if (!file) return null;

                  return (
                    <tr key={share.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-semibold text-foreground truncate max-w-xs" title={file.original_filename}>
                            {file.original_filename}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-foreground font-medium">
                        {share.sharer?.full_name || share.sharer?.email || "User"}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {share.permission}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {formatBytes(file.size_bytes)}
                      </td>

                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(share.created_at)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <a
                            href={api.getFileDownloadUrl(file.id)}
                            download={file.original_filename}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </DashboardLayout>
  );
}
