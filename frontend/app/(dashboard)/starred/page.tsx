"use client";

import React, { useEffect, useState } from "react";
import { Star, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileCard } from "@/components/files/FileCard";
import { FilePreviewModal } from "@/components/modals/FilePreviewModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { VersionHistoryModal } from "@/components/modals/VersionHistoryModal";
import { FileDetailsPanel } from "@/components/files/FileDetailsPanel";
import { api } from "@/lib/api";
import { FileItem } from "@/types";

export default function StarredPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileItem | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileItem | null>(null);

  const loadStarred = () => {
    setIsLoading(true);
    api.getStarredFiles()
      .then((res) => setFiles(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadStarred();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex h-full">
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">Starred Files</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quick access to your prioritized files and bookmarks.
            </p>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              Loading starred files...
            </div>
          ) : files.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl bg-card">
              <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold text-sm text-foreground">No starred files</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click the star icon on any file to pin it here for quick reference.
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
                  onRefresh={loadStarred}
                />
              ))}
            </div>
          )}
        </div>

        {detailsFile && (
          <FileDetailsPanel
            file={detailsFile}
            onClose={() => setDetailsFile(null)}
            onRefresh={loadStarred}
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
        onVersionRestored={loadStarred}
      />
    </DashboardLayout>
  );
}
