"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      await register(name.trim(), email.trim(), password, confirmPassword);
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please check the requirements.");
    } finally {
      setIsLoading(false);
    }
  };

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Branding header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-foreground">
              CloudVault
            </span>
          </Link>
          <h2 className="text-xl font-bold text-foreground">Create your account</h2>
          <p className="text-xs text-muted-foreground">
            Get 1 GB of free secure cloud storage instantly
          </p>
        </div>

        {/* Register Card */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-xl space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-foreground mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Alex Taylor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-accent/40 border border-border rounded-lg pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-accent/40 border border-border rounded-lg pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-accent/40 border border-border rounded-lg pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>

              {/* Password strength checklist */}
              {password && (
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                  <span className={`flex items-center gap-1 ${hasLength ? "text-emerald-600 font-medium" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> 8+ characters
                  </span>
                  <span className={`flex items-center gap-1 ${hasUpper ? "text-emerald-600 font-medium" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> Uppercase letter
                  </span>
                  <span className={`flex items-center gap-1 ${hasLower ? "text-emerald-600 font-medium" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> Lowercase letter
                  </span>
                  <span className={`flex items-center gap-1 ${hasNumber ? "text-emerald-600 font-medium" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> At least 1 number
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-accent/40 border border-border rounded-lg pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !name || !email || !password || !confirmPassword}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all text-xs"
            >
              {isLoading ? "Creating Vault..." : "Create Free Account"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
