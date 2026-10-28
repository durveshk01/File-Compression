# CloudVault Architecture & System Design

## 1. Executive Summary

**CloudVault** is a cloud file storage and secure sharing platform engineered with high performance, modularity, and enterprise-grade security. It provides file management, recursive folder hierarchies, multi-version file lifecycle management, cryptographic integrity verification, granular access control, and expiring password-protected public share links.

---

## 2. System Architecture

CloudVault follows a clean, decoupled three-tier architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Web Client (Browser)                 │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (REST / JSON)
                           ▼
┌────────────────────────────────────────────────────────┐
│             Next.js 14 Frontend Application            │
│   (App Router, React 18, Tailwind CSS, TypeScript)     │
└──────────────────────────┬─────────────────────────────┘
                           │ Reverse Proxy / API Client
                           ▼
┌────────────────────────────────────────────────────────┐
│                 FastAPI REST API Server                │
│ ┌────────────────────────────────────────────────────┐ │
│ │  API Routers (Auth, Files, Folders, Shares, etc.)  │ │
│ ├────────────────────────────────────────────────────┤ │
│ │  Service Layer (Business Logic & Transactions)     │ │
│ ├────────────────────────────────────────────────────┤ │
│ │  Storage Abstraction Layer                         │ │
│ └─────────┬──────────────────────────────┬───────────┘ │
└───────────┼──────────────────────────────┼─────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────┐   ┌──────────────────────────┐
│  PostgreSQL / SQLite    │   │     Storage Provider     │
│  (Metadata, Auth, ACL,  │   │  ┌────────────────────┐  │
│   Activity, Versions)   │   │  │ Local Filesystem   │  │
│                         │   │  ├────────────────────┤  │
│                         │   │  │ AWS S3 / MinIO /   │  │
│                         │   │  │ Cloudflare R2      │  │
│                         │   │  └────────────────────┘  │
└─────────────────────────┘   └──────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Next.js 14 Frontend

- **Framework**: Next.js 14 App Router, React 18, TypeScript.
- **Styling**: Tailwind CSS with CSS variable-driven light/dark theming and custom SaaS typography.
- **State & Context**:
  - `AuthProvider`: Reactive authentication state, session bootstrap, and auto-refresh.
  - `ThemeProvider`: Persistent light/dark mode preference via local storage and CSS classes.
- **Visualizations**: Recharts for interactive storage breakdown pie charts and category bar charts.
- **Key Modules**:
  - `files/page.tsx`: Full dual-mode (grid/list) file explorer with multi-select, breadcrumbs, search, and context menus.
  - `storage/page.tsx`: Storage quota breakdown and capacity analysis.
  - `activity/page.tsx`: Full audit log of all file operations.
  - `shared/[token]/page.tsx`: Secure unauthenticated public share download and preview portal.

### 3.2 FastAPI Backend

- **Framework**: FastAPI (Python 3.12) with asynchronous request processing and Pydantic v2 schemas.
- **Data Access**: SQLAlchemy 2.0 ORM with connection pooling, declarative models, and database-agnostic UUID handling.
- **Security Middleware**: Content Security Policy (CSP), X-Frame-Options (`SAMEORIGIN`), X-Content-Type-Options (`nosniff`), Strict-Transport-Security (`HSTS`), and Cross-Origin Resource Sharing (`CORS`).

### 3.3 Storage Abstraction Layer

The `StorageProvider` abstract base class isolates the application from physical disk implementations:

```python
class StorageProvider(ABC):
    @abstractmethod
    async def save_file(self, content: bytes, storage_key: str) -> str: ...
    
    @abstractmethod
    async def get_file(self, storage_key: str) -> bytes: ...
    
    @abstractmethod
    async def delete_file(self, storage_key: str) -> bool: ...
    
    @abstractmethod
    async def file_exists(self, storage_key: str) -> bool: ...
```

- **`LocalStorageProvider`**: Uses non-blocking `asyncio.to_thread` for asynchronous filesystem I/O, prevents directory traversal attacks via path resolution checks, and writes safely to `./storage_data/`.
- **`S3StorageProvider`**: Connects to AWS S3, Cloudflare R2, or local MinIO instances with presigned URL support.

---

## 4. Key Design Decisions

1. **Metadata vs. Blob Separation**: Database stores only file metadata, tags, permissions, and cryptographic checksums. Physical bytes are stored in the storage provider, ensuring lightweight database backups and seamless scale.
2. **Dual-Driver Database Auto-Detection**: SQLite for quick zero-configuration local development; PostgreSQL via `psycopg` v3 driver for production concurrency.
3. **Immutable File Versioning**: Uploading a new version creates a new `FileVersion` record and storage key, while keeping previous versions intact for instant rollback or auditing.
