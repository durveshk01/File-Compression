# CloudVault — Cloud File Storage & Secure Sharing Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js 14](https://img.shields.io/badge/Frontend-Next.js_14-black.svg?style=flat&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Python 3.12](https://img.shields.io/badge/Language-Python_3.12-3776AB.svg?style=flat&logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16-4169E1.svg?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED.svg?style=flat&logo=docker)](https://www.docker.com)
[![Pytest](https://img.shields.io/badge/Tests-26%20Passed-brightgreen.svg?style=flat)](https://docs.pytest.org)

**CloudVault** is an enterprise-grade cloud file storage and secure sharing platform built from the ground up with **FastAPI**, **Next.js 14 App Router**, **TypeScript**, and **PostgreSQL**. Designed with a commercial SaaS user experience inspired by Google Drive and Dropbox, CloudVault demonstrates modern full-stack software engineering, defense-in-depth security, and cloud storage abstractions.

---

## 🚀 Key Features

### 📁 File Management & Explorer
- **Dual View Modes**: Seamless toggle between interactive Grid cards and detailed Table/List rows.
- **Hierarchical Folders**: Create, rename, delete, and navigate nested folder structures with real-time breadcrumbs.
- **Drag-and-Drop Uploads**: Upload individual or multiple files with progress tracking, mime-type validation, and duplicate handling.
- **In-Browser Previews**: Native modal previewing for images, PDFs, code files, and plain text.
- **Search & Filtering**: Instant server-side search by filename, category filter (Documents, Images, Media, Archives), and tag filters.
- **Bulk Actions**: Multi-select toolbar for batch moves, soft-deletes, and restorations.

### 🔒 Enterprise Sharing & Access Control
- **Direct User Sharing**: Share files with other registered users as a **Viewer** or **Editor**.
- **Expiring Public Links**: Generate tokenized share links with custom expiration dates (`expires_at`).
- **Download Limits**: Restrict link usage with a maximum download counter (`max_downloads`).
- **Password-Protected Links**: Enforce Argon2id password protection on sensitive public shared files.
- **Granular Permissions**: View-only links prevent direct downloads; download-enabled links allow full transfers.

### ⏱️ File Versioning & Rollback
- **Historical Snapshots**: Every new file revision is tracked with an immutable snapshot in `file_versions`.
- **Instant Rollback**: Restore any past version with a single click while preserving complete audit history.
- **SHA-256 Checksums**: Every uploaded revision has an automatic cryptographic checksum calculated to guarantee data integrity.

### 📊 Storage & Audit Intelligence
- **Interactive Visualizations**: Recharts-powered pie charts and bar charts breaking down disk usage by file category.
- **Quota Tracking**: Real-time warnings when storage consumption reaches 75% or 90% of account limits.
- **Activity Log**: Comprehensive audit trail recording uploads, downloads, sharing events, and restorations.
- **Soft Delete & Trash Purge**: Two-stage trash management with instant restoration or permanent purging.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Zod |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, SlowAPI |
| **Database** | PostgreSQL 16 (Production/Docker), SQLite (Zero-config local development) |
| **Storage Engine** | Abstract Storage Provider: Local Filesystem Storage & AWS S3 / MinIO Object Storage |
| **Authentication** | Argon2id Password Hashing, HMAC-SHA256 JWT, Secure HttpOnly SameSite Cookies |
| **DevOps & CI/CD**| Docker, Docker Compose, GitHub Actions CI/CD |

---

## 🏗️ System Architecture

```
Browser (Next.js 14 Frontend @ Port 3000)
    │
    ▼ HTTPS / REST API
FastAPI Backend Server (@ Port 8000)
    ├── Auth & Users Router (Argon2id + JWT + HttpOnly Cookies)
    ├── Files & Folders Router (Search, Breadcrumbs, Bulk Actions)
    ├── Versioning Router (Snapshot creation & Rollback)
    ├── Shares Router (Direct ACL & Password-Protected Public Links)
    ├── Dashboard & Storage Router (Recharts analytics & Quota checks)
    └── Storage Abstraction Layer
            ├── LocalStorageProvider (Asyncio filesystem jail)
            └── S3StorageProvider (AWS S3 / MinIO / Cloudflare R2)
    │
    ▼ Database Layer
PostgreSQL 16 / SQLite (Metadata, ACL, Activity, Versions)
```

---

## ⚡ Quick Start

### Option A: Running with Docker Compose (Recommended)

Start the complete multi-container stack (PostgreSQL, MinIO, Backend, Frontend) with one command:

```bash
# 1. Clone repository and navigate to directory
cd cloudvault

# 2. Copy sample environment file
cp .env.example .env

# 3. Build and launch all services
docker compose up -d --build
```

- **Frontend App**: `http://localhost:3000`
- **Backend API Docs**: `http://localhost:8000/docs`
- **MinIO Console**: `http://localhost:9001` (user: `cloudvault_minio` / pass: `minio_secure_pass_123`)

---

### Option B: Running Locally (Development Mode)

#### 1. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (creates SQLite cloudvault.db automatically)
alembic upgrade head

# Seed initial demo account and sample files
python app/scripts/seed.py

# Launch FastAPI server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 🔑 Demo Account Credentials

Use the pre-seeded account to explore all features instantly:

- **Email**: `demo@cloudvault.com`
- **Password**: `DemoPassword123!`

*(The login screen also includes a one-click "Fill Demo Credentials" button).*

---

## 🧪 Testing Suite

### Backend Unit & Integration Tests (Pytest)
```bash
cd backend
python -m pytest tests/ -v
```
All **26 tests** execute against an isolated in-memory SQLite database covering:
- Authentication & registration workflows
- Data isolation between multiple users
- File uploads, downloads, and checksum verification
- Directory loops and path traversal prevention
- Direct file sharing and access revocation
- Tokenized public share links with passwords & download caps
- Storage adapter isolation & version rollback

### Frontend Typechecking & Production Build
```bash
cd frontend
npm run build
```
Compiles and prerenders all 18 routes with zero type errors.

---

## 📚 Technical Documentation

Comprehensive engineering documentation is available in the [`docs/`](./docs) directory:

- [System Architecture & Design Decisions](./docs/architecture.md)
- [Database Schema & ER Models](./docs/database.md)
- [REST API Endpoint Specification](./docs/api.md)
- [Security Engineering & Defense-in-Depth](./docs/security.md)
- [Production Deployment & Infrastructure Guide](./docs/deployment.md)

---

## ⚖️ License

Distributed under the MIT License. Built for B.Tech Computer Science & Engineering portfolio demonstration.
