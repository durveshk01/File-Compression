# CloudVault Security Engineering & Hardening

## 1. Security Architecture Overview

CloudVault adheres to defense-in-depth principles across all application layers.

```
┌────────────────────────────────────────────────────────┐
│                   Transport Security                   │
│          TLS / HTTPS, Strict HSTS, CORS                │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│               Application Layer Security               │
│  - Argon2id Password Hashing (RFC 9106)                │
│  - Signed JWT Tokens (HS256) + HttpOnly Cookies        │
│  - HTTP Security Headers (CSP, X-Frame-Options)        │
│  - Rate Limiting via SlowAPI                           │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│               Data & Storage Isolation                 │
│  - Cryptographic SHA-256 Checksums                     │
│  - Safe Random UUID Storage Keys (Path Traversal Proof)│
│  - Strict Tenant/User Data Isolation                   │
│  - Granular RBAC (Owner, Editor, Viewer)               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Credential Storage

### 2.1 Argon2id Hashing
All user passwords and link-sharing passwords are hashed using **Argon2id** (the winner of the Password Hashing Competition) via the `argon2-cffi` library:
- Memory cost: 65,536 KiB (64 MiB)
- Time cost: 3 iterations
- Parallelism: 4 lanes
- Plaintext passwords and hashes are never returned by any API endpoint.

### 2.2 Token & Session Management
- **Access Tokens**: Short-lived (30 minutes) JSON Web Tokens signed with HMAC-SHA256 (`HS256`).
- **Refresh Tokens**: Long-lived (7 days) secure tokens stored in `HttpOnly`, `SameSite=Lax` cookies, preventing cross-site scripting (XSS) credential theft.

---

## 3. Storage Security & Path Traversal Prevention

1. **Storage Key Isolation**:
   - Files are never stored under their user-provided filenames on disk.
   - Every file version receives a secure, random UUID storage key:
     `{user_id}/{uuid.uuid4()}`
   - Filenames with path traversal characters (e.g. `../../etc/passwd` or `..\..\Windows`) are stripped and sanitized.
2. **Local Storage Jail**:
   - The `LocalStorageProvider` resolves real paths and asserts that target paths strictly reside within the configured root directory:
     ```python
     if not os.path.realpath(target_path).startswith(os.path.realpath(self.base_path)):
         raise SecurityException("Path traversal attempt detected.")
     ```

---

## 4. File Integrity & Checksums

- During upload, the server streams the file content through a cryptographic `hashlib.sha256()` accumulator.
- The resulting hex digest is recorded in `File.checksum` and `FileVersion.checksum`.
- Download requests can compare client and server checksums to verify bit-level integrity.

---

## 5. HTTP Security Headers

FastAPI middleware automatically injects the following security headers on every response:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 6. Public Link Security Features

- **Token Entropy**: 32-byte cryptographic random tokens generated with `secrets.token_urlsafe(32)`.
- **Expiration Enforcement**: Automatic link invalidation once `expires_at` has passed.
- **Download Throttling**: Strict `max_downloads` counters decremented atomically in database transactions.
- **View-Only Enforcement**: Links marked `permission: "view"` reject direct binary download endpoints with HTTP 403 Forbidden.
