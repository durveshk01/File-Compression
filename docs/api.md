# CloudVault REST API Specification

## 1. Overview

The CloudVault backend exposes a REST API powered by FastAPI.

- **Base URL**: `http://localhost:8000/api`
- **Interactive Documentation**:
  - Swagger UI: `http://localhost:8000/docs`
  - ReDoc: `http://localhost:8000/redoc`
- **Authentication**: JWT Bearer tokens in `Authorization: Bearer <token>` header or HttpOnly session cookies.

---

## 2. API Endpoints

### 2.1 Authentication & Profile (`/api/auth`, `/api/users`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new user | No |
| `POST` | `/api/auth/login` | Authenticate with email and password | No |
| `POST` | `/api/auth/refresh` | Refresh expired access token | No |
| `POST` | `/api/auth/logout` | Invalidate cookie session | Yes |
| `GET` | `/api/auth/me` | Get current user's profile | Yes |
| `PATCH` | `/api/users/me` | Update full name or profile fields | Yes |
| `POST` | `/api/auth/change-password` | Change account password | Yes |

---

### 2.2 Files Management (`/api/files`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/files` | List files with filtering, sorting, pagination | Yes |
| `POST` | `/api/files/upload` | Multipart file upload | Yes |
| `GET` | `/api/files/{id}` | Get file metadata | Yes |
| `PATCH` | `/api/files/{id}` | Rename file or toggle star | Yes |
| `POST` | `/api/files/{id}/move` | Move file to a different folder | Yes |
| `DELETE` | `/api/files/{id}` | Soft delete (move to Trash) | Yes |
| `GET` | `/api/files/{id}/download` | Stream file content | Yes |
| `GET` | `/api/files/{id}/preview` | Stream file for browser preview | Yes |
| `POST` | `/api/files/bulk-action` | Batch trash, move, or delete | Yes |

---

### 2.3 File Versioning (`/api/files/{id}/versions`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/files/{id}/versions` | List all historical versions of a file | Yes |
| `POST` | `/api/files/{id}/versions` | Upload a new revision of the file | Yes |
| `POST` | `/api/files/{id}/versions/{v_id}/restore` | Restore file to a previous version | Yes |

---

### 2.4 Folders Management (`/api/folders`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/folders` | List subfolders in a directory | Yes |
| `POST` | `/api/folders` | Create a new folder | Yes |
| `GET` | `/api/folders/{id}` | Get folder metadata | Yes |
| `PATCH` | `/api/folders/{id}` | Rename folder | Yes |
| `POST` | `/api/folders/{id}/move` | Move folder (prevents descendant loops) | Yes |
| `DELETE` | `/api/folders/{id}` | Soft delete folder and contents | Yes |
| `GET` | `/api/folders/{id}/breadcrumbs` | Get ancestor path for navigation | Yes |

---

### 2.5 Sharing & Access Control (`/api/files/{id}/shares`, `/api/public/shares`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/files/{id}/shares` | Share file with another user by email | Yes |
| `GET` | `/api/files/{id}/shares` | List active direct shares on file | Yes |
| `DELETE` | `/api/shares/{share_id}` | Revoke direct user share | Yes |
| `GET` | `/api/shared-with-me` | Files shared with current user | Yes |
| `GET` | `/api/shared-by-me` | Files current user has shared | Yes |
| `POST` | `/api/files/{id}/share-links` | Create a tokenized public share link | Yes |
| `GET` | `/api/files/{id}/share-links` | List public share links on file | Yes |
| `DELETE` | `/api/share-links/{link_id}` | Revoke public share link | Yes |
| `GET` | `/api/public/shares/{token}` | Get public link metadata (unlocked status) | No |
| `POST` | `/api/public/shares/{token}/verify` | Verify password for protected link | No |
| `GET` | `/api/public/shares/{token}/download` | Download public shared file | No (Protected) |
| `GET` | `/api/public/shares/{token}/preview` | Preview public shared file | No (Protected) |

---

### 2.6 Dashboard, Storage & System

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/dashboard/stats` | Aggregate stats, file distribution, recent items | Yes |
| `GET` | `/api/dashboard/recent` | Recent uploaded files | Yes |
| `GET` | `/api/storage/usage` | Current quota and storage consumption | Yes |
| `GET` | `/api/trash` | List trashed files | Yes |
| `POST` | `/api/trash/{id}/restore` | Restore file from trash | Yes |
| `DELETE` | `/api/trash/{id}/permanent` | Purge file permanently | Yes |
| `DELETE` | `/api/trash/empty` | Purge all items in trash | Yes |
| `GET` | `/api/favorites` | List starred files | Yes |
| `GET` | `/api/activity` | User audit log feed | Yes |
| `GET` | `/api/notifications` | User notifications list | Yes |
| `GET` | `/api/health` | Service health check | No |
