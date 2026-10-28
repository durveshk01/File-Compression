"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User as UserIcon,
  Shield,
  Mail,
  Calendar,
  HardDrive,
  Save,
  CheckCircle,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage("Full name cannot be empty");
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api.updateProfile(fullName.trim());
      await refreshUser();
      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "CV";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal profile, credentials, and account preferences.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border gap-6">
          <Link
            href="/settings/profile"
            className="pb-3 text-sm font-semibold border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 flex items-center gap-2"
          >
            <UserIcon className="w-4 h-4" />
            Profile
          </Link>
          <Link
            href="/settings/security"
            className="pb-3 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            Security & Password
          </Link>
        </div>

        {/* Profile Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          {/* Avatar and basic info */}
          <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-border">
            <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-indigo-600/30">
              {getInitials(user?.full_name)}
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-lg font-bold text-foreground">
                {user?.full_name || "CloudVault User"}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Active Account
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Joined {user?.created_at ? formatDate(user.created_at) : "Recently"}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-5">
            {successMessage && (
              <div className="flex items-center gap-2 p-3 text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 text-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Email Address (Primary)
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-muted text-muted-foreground cursor-not-allowed select-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Contact system administrator to change your email address.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Account ID
                </label>
                <input
                  type="text"
                  value={user?.id || ""}
                  disabled
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-border bg-muted text-muted-foreground cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Storage Allocation
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-muted text-xs text-muted-foreground">
                  <HardDrive className="w-4 h-4 text-indigo-500" />
                  <span>
                    {formatBytes(user?.storage_used_bytes || 0)} used of {formatBytes(user?.storage_quota_bytes || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
