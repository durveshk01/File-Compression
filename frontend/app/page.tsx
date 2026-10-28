"use client";

import React from "react";
import Link from "next/link";
import {
  Shield,
  Cloud,
  Lock,
  Share2,
  History,
  FileCheck,
  HardDrive,
  Eye,
  CheckCircle2,
  ArrowRight,
  Layers,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* 1. Navbar */}
      <header className="h-20 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">
              CloudVault
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-foreground transition-colors">
              Security
            </a>
            <a href="#architecture" className="hover:text-foreground transition-colors">
              Architecture
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-foreground hover:bg-accent transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                >
                  Get Started
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            Zero-Trust Cloud Storage Architecture
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.15]">
            Your Files. <span className="text-indigo-600">Organized.</span> Secure. Accessible.
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed">
            Store, organize, and share your files with a secure cloud storage platform designed for simplicity, auditability, and absolute data control.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              Get Started Free (1 GB Quota)
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-border bg-card hover:bg-accent text-foreground text-sm font-semibold transition-colors"
            >
              Sign In to Your Vault
            </Link>
          </div>

          {/* Realistic Product Preview Mockup */}
          <div className="pt-12 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-2xl overflow-hidden p-2">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Browser top chrome */}
                <div className="h-9 bg-muted/30 border-b border-border px-4 flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <div className="mx-auto w-72 h-5 rounded-md bg-accent/60 flex items-center justify-center text-[10px] text-muted-foreground font-mono">
                    https://cloudvault.app/dashboard
                  </div>
                </div>

                {/* Simulated Dashboard Interface */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                  <div className="p-4 rounded-xl border border-border bg-accent/20 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Total Files</p>
                    <p className="text-2xl font-bold text-foreground">1,248</p>
                    <span className="text-[10px] text-emerald-600 font-semibold">Active & Indexed</span>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-accent/20 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Storage Used</p>
                    <p className="text-2xl font-bold text-foreground">428 MB</p>
                    <span className="text-[10px] text-indigo-600 font-semibold">of 1 GB Local Quota</span>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-accent/20 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Shared Files</p>
                    <p className="text-2xl font-bold text-foreground">24</p>
                    <span className="text-[10px] text-blue-600 font-semibold">With granular ACLs</span>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-accent/20 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Version History</p>
                    <p className="text-2xl font-bold text-foreground">100%</p>
                    <span className="text-[10px] text-purple-600 font-semibold">Non-destructive edits</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-24 bg-card/40 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 space-y-14">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
              Core Capabilities
            </h2>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              Built for Security, Speed, and Control
            </p>
            <p className="text-sm text-muted-foreground">
              Every feature is implemented from first principles with full data integrity and zero AI dependencies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-border bg-card space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Argon2id Authentication</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                State-of-the-art memory-hard password hashing with short-lived JWT access tokens, HttpOnly refresh cookies, and session invalidation.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <History className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Complete File Versioning</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Replacing a file never overwrites historical data. Roll back to any prior version or download previous revisions at any time.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Share2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Restricted Sharing Links</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate expiring, password-protected sharing links with download limits. Secrets are securely hashed and never leaked.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">In-Browser File Previews</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Instant sandboxed viewing for PDFs, images, plain text, CSV tables, markdown, and source code without downloading.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Dual Storage Abstraction</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seamlessly swap between local disk storage for zero-dependency development and S3-compatible object storage (AWS, MinIO, Cloudflare R2).
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Audit & Activity Log</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every upload, download, share, rename, move, and version restore is logged to an immutable activity ledger.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" className="py-24 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 space-y-14">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
              Simple Workflow
            </h2>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              How CloudVault Works
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3 text-center md:text-left">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-indigo-600/30">
                1
              </div>
              <h3 className="font-bold text-base text-foreground">Upload & Organize</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drag and drop files into folders. Automatic SHA-256 checksums verify byte integrity and file sizes are debited against your quota.
              </p>
            </div>

            <div className="space-y-3 text-center md:text-left">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-indigo-600/30">
                2
              </div>
              <h3 className="font-bold text-base text-foreground">Secure & Version</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Files are stored with generated collision-proof storage keys. Replace files safely knowing previous revisions are preserved.
              </p>
            </div>

            <div className="space-y-3 text-center md:text-left">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-indigo-600/30">
                3
              </div>
              <h3 className="font-bold text-base text-foreground">Share with Confidence</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Collaborate with registered team members or share restricted public links with expiration timers, passwords, and download counters.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Security Architecture Section */}
      <section id="security" className="py-24 bg-card/40 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
              Security Engineering
            </h2>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              Engineered with Security at the Core
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Path Traversal Shield
              </p>
              <p className="text-muted-foreground">
                All storage keys are server-generated and validated to prevent directory escape exploits.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                No Frontend Credentials
              </p>
              <p className="text-muted-foreground">
                S3 secrets and bucket keys never touch the browser. All transfers use presigned URLs or isolated proxy streams.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Strict Authorization Checks
              </p>
              <p className="text-muted-foreground">
                File IDs alone are never sufficient to access resources. Ownership and share records are checked on every request.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Hashed Sharing Tokens
              </p>
              <p className="text-muted-foreground">
                Public share tokens are hashed using SHA-256 before database insertion to prevent credential exposure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CTA Section */}
      <section className="py-20 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Ready to Take Control of Your Cloud Storage?
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Create an account in 10 seconds and experience a secure, reliable cloud storage experience.
          </p>
          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xl shadow-indigo-600/30 transition-all"
            >
              Create Your Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="mt-auto border-t border-border py-8 bg-card text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Shield className="w-4 h-4 text-indigo-600" />
            CloudVault Platform
          </div>
          <p className="text-center">
            Built as a professional full-stack software engineering project. 100% Non-AI.
          </p>
          <p>© 2026 CloudVault. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
