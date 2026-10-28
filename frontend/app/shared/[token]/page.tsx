"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Shield,
  Download,
  Eye,
  Lock,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  File,
  CheckCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { PublicShareInfo } from "@/types";
import { formatBytes } from "@/lib/utils";

export default function PublicSharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [shareInfo, setShareInfo] = useState<PublicShareInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password state
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!token) return;

    setIsLoading(true);
    api.getPublicShareInfo(token)
      .then((info) => {
        setShareInfo(info);
        if (!info.requires_password) {
          setIsUnlocked(true);
        }
      })
      .catch((err) => {
        setError(err.message || "This shared link is invalid, expired, or has reached its download limit.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsVerifying(true);
    setPasswordError(null);

    try {
      await api.verifyPublicLinkPassword(token, password.trim());
      setIsUnlocked(true);
    } catch (err: any) {
      setPasswordError(err.message || "Incorrect password. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const getFileIcon = (mime?: string | null, filename?: string) => {
    const m = (mime || "").toLowerCase();
    const f = (filename || "").toLowerCase();

    if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(f)) {
      return <ImageIcon className="w-10 h-10 text-emerald-500" />;
    }
    if (m.startsWith("video/") || /\.(mp4|webm|mkv|mov)$/.test(f)) {
      return <Film className="w-10 h-10 text-amber-500" />;
    }
    if (m.startsWith("audio/") || /\.(mp3|wav|ogg)$/.test(f)) {
      return <Music className="w-10 h-10 text-purple-500" />;
    }
    if (m === "application/pdf" || f.endsWith(".pdf")) {
      return <FileText className="w-10 h-10 text-red-500" />;
    }
    if (/\.(zip|tar|gz|rar|7z)$/.test(f)) {
      return <Archive className="w-10 h-10 text-pink-500" />;
    }
    return <File className="w-10 h-10 text-indigo-500" />;
  };

  const downloadUrl = isUnlocked ? api.getPublicDownloadUrl(token, password) : "";
  const previewUrl = isUnlocked ? api.getPublicPreviewUrl(token, password) : "";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">CloudVault</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-lg">
          {isLoading ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-lg">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading shared file...</p>
            </div>
          ) : error ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-lg space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Link Unavailable</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {error}
              </p>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                >
                  Return to CloudVault Home
                </Link>
              </div>
            </div>
          ) : shareInfo && !isUnlocked ? (
            /* Password Protection Screen */
            <div className="bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Password Protected File</h2>
                <p className="text-xs text-muted-foreground">
                  The owner has protected <span className="font-semibold text-foreground">{shareInfo.filename}</span> with a secure password.
                </p>
              </div>

              <form onSubmit={handleVerifyPassword} className="space-y-4">
                {passwordError && (
                  <div className="flex items-center gap-2 p-3 text-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    Enter Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter link password..."
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || !password.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isVerifying ? "Verifying..." : "Unlock File"}
                </button>
              </form>
            </div>
          ) : shareInfo ? (
            /* Unlocked Shared File Card */
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
              {/* File Icon and Name */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center flex-shrink-0">
                  {getFileIcon(shareInfo.mime_type, shareInfo.filename)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Shared with you
                  </span>
                  <h1 className="text-lg font-bold text-foreground truncate mt-0.5" title={shareInfo.filename}>
                    {shareInfo.filename}
                  </h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatBytes(shareInfo.file_size)}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
                      {shareInfo.permission === "view" ? "View Only" : "Download Allowed"}
                    </span>
                    {shareInfo.downloads_remaining !== null && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {shareInfo.downloads_remaining} download{shareInfo.downloads_remaining === 1 ? "" : "s"} left
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Preview (if toggled) */}
              {showPreview && (
                <div className="rounded-xl border border-border overflow-hidden bg-background">
                  {shareInfo.mime_type?.startsWith("image/") ? (
                    <img
                      src={previewUrl}
                      alt={shareInfo.filename}
                      className="w-full max-h-96 object-contain bg-black/5"
                    />
                  ) : shareInfo.mime_type === "application/pdf" ? (
                    <iframe
                      src={previewUrl}
                      title={shareInfo.filename}
                      className="w-full h-96 border-0"
                    />
                  ) : (
                    <iframe
                      src={previewUrl}
                      title={shareInfo.filename}
                      className="w-full h-80 border-0 p-4 font-mono text-xs bg-muted/30"
                    />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {shareInfo.permission !== "view" && (
                  <a
                    href={downloadUrl}
                    download={shareInfo.filename}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </a>
                )}

                {shareInfo.preview_supported && (
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border bg-muted/50 text-foreground font-medium text-sm hover:bg-muted transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    {showPreview ? "Hide Preview" : "Preview"}
                  </button>
                )}
              </div>

              {/* Security Banner */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex items-start gap-3 text-xs text-muted-foreground">
                <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>
                  Delivered securely via CloudVault encrypted storage. Links expire automatically according to sender policies.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} CloudVault — Cloud File Storage & Secure Sharing Platform. Built with Next.js & FastAPI.</p>
      </footer>
    </div>
  );
}
