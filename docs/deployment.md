# CloudVault Deployment & Production Guide

## 1. Quick Start with Docker Compose

The fastest way to spin up the entire production-grade stack (PostgreSQL, MinIO, FastAPI Backend, Next.js Frontend) is with Docker Compose.

### 1.1 Prerequisites
- Docker Engine 24+
- Docker Compose v2+

### 1.2 Start Services

```bash
# Clone and enter directory
cd cloudvault

# Copy environment variables
cp .env.example .env

# Build and start all containers in detached mode
docker compose up -d --build
```

### 1.3 Verify Deployment

- **Frontend**: Navigate to `http://localhost:3000`
- **Backend API**: Navigate to `http://localhost:8000/api/health`
- **Swagger Docs**: Navigate to `http://localhost:8000/docs`
- **MinIO Console**: Navigate to `http://localhost:9001` (user: `cloudvault_minio`, pass: `minio_secure_pass_123`)

---

## 2. Local Manual Development Setup

If running without Docker:

### 2.1 Backend Setup

```bash
cd backend

# Create and activate Python virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Seed initial demo account (demo@cloudvault.com / DemoPassword123!)
python app/scripts/seed.py

# Run FastAPI server with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2.2 Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```

The frontend will run on `http://localhost:3000` and automatically proxy API calls to `http://localhost:8000`.

---

## 3. Production Hardening Checklist

When preparing CloudVault for a public internet deployment:

1. **Database**: Point `DATABASE_URL` to a managed PostgreSQL cluster (AWS RDS, Supabase, Neon, or Cloud SQL).
2. **Secrets**: Generate a cryptographically strong 64-character hex `SECRET_KEY`:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
3. **Storage Engine**: Switch `STORAGE_PROVIDER=s3` and configure AWS S3 or Cloudflare R2 bucket credentials.
4. **HTTPS / TLS**: Terminate TLS at a reverse proxy (e.g., Caddy, Nginx, or AWS ALB) and ensure `secure=True` on HttpOnly cookies.
5. **CORS Origins**: Set `CORS_ORIGINS` to the exact public domain (e.g. `https://vault.example.com`).
