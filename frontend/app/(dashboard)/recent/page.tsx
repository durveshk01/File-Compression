"use client";

import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileCard } from "@/components/files/FileCard";
import { FilePreviewModal } from "@/components/modals/FilePreviewModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { VersionHistoryModal } from "@/components/modals/VersionHistoryModal";
import { FileDetailsPanel } from "@/components/files/FileDetailsPanel";
import { api } from "@/lib/api";
import { FileItem } from "@/types";

export default function RecentPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileItem | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileItem | null>(null);

  const loadRecent = () => {
    setIsLoading(true);
    api.getFiles({ sort_by: "created_at", sort_order: "desc", page_size: 50 })
      .then((res) => setFiles(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadRecent();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex h-full">
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">Recent Files</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recently uploaded, accessed, or modified files.
            </p>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              Loading recent files...
            </div>
          ) : files.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl bg-card">
              <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold text-sm text-foreground">No recent files</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your latest activity will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  isSelected={detailsFile?.id === file.id}
                  onSelect={() => setDetailsFile(file)}
                  onPreview={() => setPreviewFile(file)}
                  onShare={() => setShareFile(file)}
                  onVersions={() => setVersionsFile(file)}
                  onDetails={() => setDetailsFile(file)}
                  onRefresh={loadRecent}
                />
              ))}
            </div>
          )}
        </div>

        {detailsFile && (
          <FileDetailsPanel
            file={detailsFile}
            onClose={() => setDetailsFile(null)}
            onRefresh={loadRecent}
            onShare={() => setShareFile(detailsFile)}
            onVersions={() => setVersionsFile(detailsFile)}
          />
        )}
      </div>

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
        onVersionRestored={loadRecent}
      />
    </DashboardLayout>
  );
}
