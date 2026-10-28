"use client";

import React, { useState, useRef } from "react";
import { Upload, X, CheckCircle, AlertCircle, File, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string | null;
  onUploadComplete?: () => void;
}

interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  errorMessage?: string;
}

export function UploadModal({
  isOpen,
  onClose,
  folderId,
  onUploadComplete,
}: UploadModalProps) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesAdded = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newTasks: UploadTask[] = Array.from(fileList).map((f) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      progress: 0,
      status: "pending",
    }));

    setTasks((prev) => [...prev, ...newTasks]);

    // Automatically begin upload
    newTasks.forEach((t) => startUpload(t));
  };

  const startUpload = async (task: UploadTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: "uploading", progress: 20 } : t))
    );

    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, progress: 60 } : t))
      );

      await api.uploadFile(task.file, folderId);

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "success", progress: 100 } : t))
      );
      if (onUploadComplete) onUploadComplete();
    } catch (err: any) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: "error",
                errorMessage: err.message || "Upload failed. Storage quota or size limit exceeded.",
              }
            : t
        )
      );
    }
  };

  const handleClose = () => {
    setTasks([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Upload className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Upload Files</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drag & Drop Area */}
        <div className="p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFilesAdded(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20"
                : "border-border hover:border-indigo-400 hover:bg-accent/40"
            }`}
          >
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => handleFilesAdded(e.target.files)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Click to browse or drag and drop files
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports documents, photos, audio, video, and archives up to 100MB
            </p>
          </div>

          {/* Task Progress List */}
          {tasks.length > 0 && (
            <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-border bg-accent/20 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[240px] flex items-center gap-1.5">
                      <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {task.file.name}
                    </span>
                    <span className="text-muted-foreground">{formatBytes(task.file.size)}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        task.status === "error"
                          ? "bg-red-500"
                          : task.status === "success"
                          ? "bg-emerald-500"
                          : "bg-indigo-600"
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>

                  {/* Status & Error */}
                  <div className="flex items-center justify-between text-[11px]">
                    {task.status === "uploading" && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
                        Uploading... {task.progress}%
                      </span>
                    )}
                    {task.status === "success" && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Uploaded successfully
                      </span>
                    )}
                    {task.status === "error" && (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {task.errorMessage}
                        </span>
                        <button
                          onClick={() => startUpload(task)}
                          className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-accent/10 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
