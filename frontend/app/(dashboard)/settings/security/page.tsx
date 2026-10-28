"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  Shield,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  Server,
  FileCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/lib/api";

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasDigit &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMessage(res.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to change password.");
    } finally {
      setIsSubmitting(false);
    }
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
            className="pb-3 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center gap-2"
          >
            <UserIcon className="w-4 h-4" />
            Profile
          </Link>
          <Link
            href="/settings/security"
            className="pb-3 text-sm font-semibold border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 flex items-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            Security & Password
          </Link>
        </div>

        {/* Change Password Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Change Password
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Ensure your account is protected with a strong, distinct password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Strength Requirements Checklist */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
              <span className="font-semibold text-foreground block mb-2">
                Password Requirements:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-2 ${hasUppercase ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {hasUppercase ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>At least one uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-2 ${hasLowercase ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {hasLowercase ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>At least one lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-2 ${hasDigit ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {hasDigit ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>At least one number (0-9)</span>
                </div>
                <div className={`flex items-center gap-2 sm:col-span-2 ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {passwordsMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                {isSubmitting ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                Argon2id Password Hashing
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                CloudVault never stores plaintext passwords. Credentials are protected using state-of-the-art Argon2id cryptographic password hashing with memory and time-cost parameters.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                SHA-256 File Integrity
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Every file upload has an automatic cryptographic checksum calculated to guarantee non-repudiation and prevent data corruption during transit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
