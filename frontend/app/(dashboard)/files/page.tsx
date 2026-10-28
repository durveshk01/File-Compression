"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  LayoutGrid,
  List,
  FolderPlus,
  Upload,
  Search,
  Filter,
  ArrowUpDown,
  Folder as FolderIcon,
  ChevronRight,
  Home,
  CheckSquare,
  FileQuestion,
  RefreshCw,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileCard } from "@/components/files/FileCard";
import { FileRow } from "@/components/files/FileRow";
import { FolderCard } from "@/components/files/FolderCard";
import { FileDetailsPanel } from "@/components/files/FileDetailsPanel";
import { BulkActionsToolbar } from "@/components/files/BulkActionsToolbar";
import { UploadModal } from "@/components/modals/UploadModal";
import { NewFolderModal } from "@/components/modals/NewFolderModal";
import { FilePreviewModal } from "@/components/modals/FilePreviewModal";
import { ShareModal } from "@/components/modals/ShareModal";
import { VersionHistoryModal } from "@/components/modals/VersionHistoryModal";
import { api } from "@/lib/api";
import { BreadcrumbItem, FileItem, FolderItem } from "@/types";

function FilesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const folderIdParam = searchParams.get("folder_id");
  const searchParam = searchParams.get("search");

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderIdParam);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // View state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [detailsFile, setDetailsFile] = useState<FileItem | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [versionsFile, setVersionsFile] = useState<FileItem | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load folders in current directory (only when not searching globally)
      if (!searchParam && category === "all") {
        const folderList = await api.getFolders(currentFolderId);
        setFolders(folderList);
      } else {
        setFolders([]);
      }

      // Load breadcrumbs if in subfolder
      if (currentFolderId) {
        const bcs = await api.getBreadcrumbs(currentFolderId);
        setBreadcrumbs(bcs);
      } else {
        setBreadcrumbs([]);
      }

      // Load files
      const fileData = await api.getFiles({
        folder_id: searchParam ? undefined : currentFolderId,
        category: category !== "all" ? category : undefined,
        search: searchParam || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        page_size: 50,
      });

      setFiles(fileData.items);
      setTotalFiles(fileData.total);
      setTotalPages(fileData.total_pages);
    } catch {
      // Error handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentFolderId(folderIdParam);
  }, [folderIdParam]);

  useEffect(() => {
    loadData();
    window.addEventListener("refresh_files", loadData);
    return () => window.removeEventListener("refresh_files", loadData);
  }, [currentFolderId, category, sortBy, sortOrder, currentPage, searchParam]);

  const handleSelectFile = (fileId: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      setSelectedFileIds((prev) =>
        prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
      );
    } else {
      setSelectedFileIds([fileId]);
    }
    const found = files.find((f) => f.id === fileId);
    if (found) setDetailsFile(found);
  };

  const navigateToFolder = (id: string | null) => {
    setSelectedFileIds([]);
    setCurrentFolderId(id);
    if (id) {
      router.push(`/files?folder_id=${id}`);
    } else {
      router.push(`/files`);
    }
  };

  const categories = [
    { id: "all", label: "All Files" },
    { id: "document", label: "Documents" },
    { id: "image", label: "Images" },
    { id: "video", label: "Media" },
    { id: "archive", label: "Archives" },
    { id: "code", label: "Code" },
  ];

  return (
    <DashboardLayout>
      <div className="flex h-full">
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {/* Header & Breadcrumb Nav */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <button
                onClick={() => navigateToFolder(null)}
                className={`flex items-center gap-1 hover:text-foreground font-semibold px-2 py-1 rounded-md transition-colors ${
                  !currentFolderId ? "text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40" : ""
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                My Files
              </button>

              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={bc.id}>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <button
                    onClick={() => navigateToFolder(bc.id)}
                    className={`font-semibold px-2 py-1 rounded-md transition-colors ${
                      idx === breadcrumbs.length - 1
                        ? "text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40"
                        : "hover:text-foreground"
                    }`}
                  >
                    {bc.name}
                  </button>
                </React.Fragment>
              ))}

              {searchParam && (
                <span className="ml-2 text-indigo-600 font-medium">
                  Search results for: "{searchParam}"
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNewFolderOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-accent text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
                New Folder
              </button>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File
              </button>
            </div>
          </div>

          {/* Filtering and View Control Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl shadow-sm text-xs">
            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    category === cat.id
                      ? "bg-indigo-600 text-white"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Sort & View Mode */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-accent/30 border border-border rounded-lg px-2 py-1">
                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                <select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [sb, so] = e.target.value.split("_");
                    setSortBy(sb);
                    setSortOrder(so as any);
                  }}
                  className="bg-transparent text-foreground focus:outline-none text-xs"
                >
                  <option value="created_at_desc">Newest First</option>
                  <option value="created_at_asc">Oldest First</option>
                  <option value="original_filename_asc">Name (A-Z)</option>
                  <option value="original_filename_desc">Name (Z-A)</option>
                  <option value="size_bytes_desc">Size (Largest)</option>
                  <option value="size_bytes_asc">Size (Smallest)</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-accent/20">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 transition-colors ${
                    viewMode === "grid"
                      ? "bg-card text-indigo-600 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 transition-colors ${
                    viewMode === "list"
                      ? "bg-card text-indigo-600 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Folders Section (if present) */}
          {folders.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Folders ({folders.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onClick={() => navigateToFolder(folder.id)}
                    onRefresh={loadData}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Files ({totalFiles})
              </h3>
              {files.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedFileIds.length === files.length) {
                      setSelectedFileIds([]);
                    } else {
                      setSelectedFileIds(files.map((f) => f.id));
                    }
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectedFileIds.length === files.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading vault contents...
              </div>
            ) : files.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl bg-card">
                <FileQuestion className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-semibold text-sm text-foreground">No files found here</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Drag and drop files to upload, or create subfolders to organize.
                </p>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload to this folder
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    isSelected={selectedFileIds.includes(file.id)}
                    onSelect={(e) => handleSelectFile(file.id, e)}
                    onPreview={() => setPreviewFile(file)}
                    onShare={() => setShareFile(file)}
                    onVersions={() => setVersionsFile(file)}
                    onDetails={() => setDetailsFile(file)}
                    onRefresh={loadData}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-accent/20 text-muted-foreground text-[11px] uppercase font-semibold text-left">
                      <th className="py-2.5 px-3 w-8" />
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">Type</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Version</th>
                      <th className="py-2.5 px-3 hidden lg:table-cell">Modified</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        isSelected={selectedFileIds.includes(file.id)}
                        onSelect={(e) => handleSelectFile(file.id, e)}
                        onPreview={() => setPreviewFile(file)}
                        onShare={() => setShareFile(file)}
                        onVersions={() => setVersionsFile(file)}
                        onDetails={() => setDetailsFile(file)}
                        onRefresh={loadData}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 text-xs">
                <span className="text-muted-foreground">
                  Page {currentPage} of {totalPages} ({totalFiles} files total)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Details Panel */}
        {detailsFile && (
          <FileDetailsPanel
            file={detailsFile}
            onClose={() => setDetailsFile(null)}
            onRefresh={loadData}
            onShare={() => setShareFile(detailsFile)}
            onVersions={() => setVersionsFile(detailsFile)}
          />
        )}
      </div>

      {/* Bulk Action Floating Bar */}
      <BulkActionsToolbar
        selectedIds={selectedFileIds}
        onClearSelection={() => setSelectedFileIds([])}
        onRefresh={loadData}
      />

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        folderId={currentFolderId}
        onUploadComplete={loadData}
      />

      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        parentId={currentFolderId}
        onFolderCreated={loadData}
      />

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
        onVersionRestored={loadData}
      />
    </DashboardLayout>
  );
}

export default function FilesPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </DashboardLayout>
      }
    >
      <FilesContent />
    </Suspense>
  );
}
