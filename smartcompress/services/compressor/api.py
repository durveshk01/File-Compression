from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import BackgroundTasks, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .engine import MAX_IMAGE_PIXELS, CompressionError, compress, detect

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "apps" / "web"
DATA = Path(os.getenv("SMARTCOMPRESS_DATA_DIR", str(ROOT / ".smartcompress-data"))).resolve()
MAX_UPLOAD = int(os.getenv("SMARTCOMPRESS_MAX_UPLOAD_MB", "256")) * 1024 * 1024
RETENTION = int(os.getenv("SMARTCOMPRESS_RETENTION_HOURS", "2")) * 3600
MAX_JOBS = max(1, int(os.getenv("SMARTCOMPRESS_MAX_JOBS", "2")))
JOB_TIMEOUT = int(os.getenv("SMARTCOMPRESS_JOB_TIMEOUT_SECONDS", "900"))
DATA.mkdir(parents=True, exist_ok=True)
uploads: dict[str, dict] = {}
jobs: dict[str, dict] = {}
locks = asyncio.Semaphore(MAX_JOBS)
ip_events: dict[str, list[float]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def cleanup_loop():
        while True:
            await asyncio.sleep(600)
            cutoff = time.time() - RETENTION
            for entry in DATA.iterdir():
                try:
                    if entry.is_dir() and entry.stat().st_mtime < cutoff: shutil.rmtree(entry, ignore_errors=True)
                except OSError:
                    pass
            for table in (uploads, jobs):
                expired = [key for key, record in table.items() if record.get("created_at", time.time()) < cutoff]
                for key in expired: table.pop(key, None)
    cutoff = time.time() - RETENTION
    for entry in DATA.iterdir():
        try:
            if entry.is_dir() and entry.stat().st_mtime < cutoff: shutil.rmtree(entry, ignore_errors=True)
        except OSError:
            pass
    cleaner = asyncio.create_task(cleanup_loop())
    yield
    cleaner.cancel()


app = FastAPI(title="SmartCompress API", version="1.0.0", description="Format-aware compression API with scoped temporary file tokens. Files are automatically deleted after the configured retention period.", lifespan=lifespan)
origins = [x.strip() for x in os.getenv("SMARTCOMPRESS_CORS_ORIGINS", "http://localhost:8000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type", "Authorization"], allow_credentials=False)


@app.middleware("http")
async def secure_headers(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent = [t for t in ip_events.get(ip, []) if now - t < 60]
    if len(recent) >= 120:
        return HTMLResponse("Too many requests. Please wait a minute.", status_code=429)
    recent.append(now); ip_events[ip] = recent
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    response.headers["Cache-Control"] = "no-store"
    return response


class JobRequest(BaseModel):
    upload_id: str = Field(min_length=32, max_length=32)
    upload_token: str = Field(min_length=32, max_length=64)
    target_bytes: int | None = Field(default=None, gt=0, le=8_589_934_592)
    mode: str = Field(default="balanced", pattern="^(balanced|lossless|smallest|exact)$")


def _safe_name(value: str) -> str:
    name = Path(value.replace("\\", "/")).name
    name = re.sub(r"[^\w.() -]", "_", name, flags=re.UNICODE).strip(" .")[:120]
    return name or "uploaded-file"


def _authorized(record: dict | None, token: str | None):
    if not record or not token or not secrets.compare_digest(record["token"], token):
        raise HTTPException(404, "This file or job was not found or its access token is invalid.")


def _job_auth(job_id: str, token: str | None) -> dict:
    job = jobs.get(job_id)
    _authorized(job, token)
    return job


def _bearer_token(authorization: str | None, legacy_token: str | None = None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return legacy_token


@app.post("/api/v1/files", status_code=201, tags=["files"])
async def upload_file(file: UploadFile = File(...)):
    upload_id, token = secrets.token_hex(16), secrets.token_urlsafe(32)
    directory = DATA / upload_id
    directory.mkdir(mode=0o700)
    name = _safe_name(file.filename or "uploaded-file")
    path = directory / "source.bin"
    size = 0
    try:
        with path.open("wb") as target:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk: break
                size += len(chunk)
                if size > MAX_UPLOAD: raise HTTPException(413, f"The upload exceeds the {MAX_UPLOAD // (1024 * 1024)} MB limit.")
                target.write(chunk)
        if not size: raise HTTPException(400, "The uploaded file is empty.")
        try: info = await asyncio.to_thread(detect, path, name)
        except CompressionError as exc: raise HTTPException(422, str(exc)) from exc
        record = {"upload_id": upload_id, "token": token, "path": str(path), "filename": name, "size": size, "created_at": time.time(), **info}
        uploads[upload_id] = record
        return {"upload_id": upload_id, "upload_token": token, "filename": name, "size": size, **info}
    except BaseException:
        shutil.rmtree(directory, ignore_errors=True)
        raise
    finally:
        await file.close()
    

async def _process(job_id: str, upload: dict, target_bytes: int | None, mode: str):
    job = jobs[job_id]
    try:
        async with locks:
            if job["cancel"].is_set(): job["status"] = "cancelled"; return
            job["status"] = "processing"; job["started_at"] = time.time()
            result_dir = DATA / job_id / "result"
            result_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            result = await asyncio.wait_for(asyncio.to_thread(compress, Path(upload["path"]), upload["filename"], result_dir, target_bytes, mode, JOB_TIMEOUT, job["cancel"].is_set), timeout=JOB_TIMEOUT + 5)
            if job["cancel"].is_set(): job["status"] = "cancelled"; return
            original_size = upload["size"]
            output = Path(result["path"])
            if output.parent != result_dir and output != Path(upload["path"]):
                raise CompressionError("The output failed a safety check.")
            final_size = output.stat().st_size
            extension = Path(upload["filename"]).suffix.lstrip(".") if output == Path(upload["path"]) else output.suffix.lstrip(".")
            job.update(status="completed", result_path=str(output), output_name=_safe_name(Path(upload["filename"]).stem + "." + extension), output_format=result["format"], message=result["message"], warnings=result["warnings"], target_reached=result["target_reached"], original_size=original_size, final_size=final_size, duration_ms=round((time.time() - job["started_at"]) * 1000), target_bytes=target_bytes, iterations=result["iterations"])
    except asyncio.TimeoutError:
        job.update(status="failed", error="This file took too long to process. Try a smaller file or a faster format.")
    except CompressionError as exc:
        job.update(status="cancelled" if "cancelled" in str(exc).lower() else "failed", error=str(exc))
    except Exception as exc:
        # Detailed diagnostics remain server-side and exclude file bytes/metadata.
        print(f"SmartCompress worker error: {type(exc).__name__}")
        job.update(status="failed", error="Processing failed unexpectedly. Your original file is still available to try again.")


@app.post("/api/v1/compression-jobs", status_code=202, tags=["jobs"])
async def create_job(body: JobRequest, background: BackgroundTasks):
    upload = uploads.get(body.upload_id)
    if upload is None:
        # Upload records are kept in process memory; reconstruct only if the scoped token matches.
        folder = DATA / body.upload_id
        path = folder / "source.bin"
        if not path.is_file(): raise HTTPException(404, "The uploaded file has expired. Upload it again.")
        raise HTTPException(404, "The upload token expired after a server restart. Upload it again.")
    _authorized(upload, body.upload_token)
    if not upload["supported"]: raise HTTPException(422, f"{upload['format']} files are detected but cannot be safely compressed by this installation.")
    job_id, token = secrets.token_hex(16), secrets.token_urlsafe(32)
    record = {"id": job_id, "token": token, "status": "queued", "created_at": time.time(), "cancel": __import__("threading").Event(), "filename": upload["filename"], "category": upload["category"], "format": upload["format"], "size": upload["size"]}
    jobs[job_id] = record
    background.add_task(_process, job_id, upload, body.target_bytes, body.mode)
    return {"job_id": job_id, "job_token": token, "status": "queued", "events_url": f"/api/v1/compression-jobs/{job_id}/events"}


def _public(job: dict) -> dict:
    keys = ("id", "status", "filename", "category", "format", "size", "output_name", "output_format", "message", "warnings", "target_reached", "original_size", "final_size", "duration_ms", "target_bytes", "iterations", "error")
    return {key: job[key] for key in keys if key in job}


@app.get("/api/v1/compression-jobs/{job_id}", tags=["jobs"])
async def get_job(job_id: str, authorization: str | None = Header(default=None)):
    return _public(_job_auth(job_id, _bearer_token(authorization)))


@app.get("/api/v1/compression-jobs/{job_id}/events", tags=["jobs"])
async def job_events(job_id: str, request: Request, authorization: str | None = Header(default=None)):
    job = _job_auth(job_id, _bearer_token(authorization))
    async def stream():
        last = None
        while not await request.is_disconnected():
            data = json.dumps(_public(job))
            if data != last:
                yield f"event: status\ndata: {data}\n\n"; last = data
            if job["status"] in {"completed", "failed", "cancelled"}: break
            await asyncio.sleep(.5)
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"})


@app.post("/api/v1/compression-jobs/{job_id}/cancel", tags=["jobs"])
async def cancel_job(job_id: str, authorization: str | None = Header(default=None)):
    job = _job_auth(job_id, _bearer_token(authorization))
    if job["status"] in {"queued", "processing"}:
        job["cancel"].set(); job["status"] = "cancelled"
    return _public(job)


@app.get("/api/v1/compression-jobs/{job_id}/download", tags=["jobs"])
async def download_job(job_id: str, authorization: str | None = Header(default=None)):
    job = _job_auth(job_id, _bearer_token(authorization))
    if job["status"] != "completed" or not Path(job.get("result_path", "")).is_file(): raise HTTPException(409, "The result is not ready or has expired.")
    return FileResponse(job["result_path"], filename=job["output_name"], media_type="application/octet-stream", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(job['output_name'])}"})


@app.get("/api/v1/compression-jobs/{job_id}/preview", tags=["jobs"])
async def preview_job(job_id: str, authorization: str | None = Header(default=None)):
    job = _job_auth(job_id, _bearer_token(authorization))
    if job["status"] != "completed" or not Path(job.get("result_path", "")).is_file(): raise HTTPException(409, "The result is not ready or has expired.")
    extension = Path(job["output_name"]).suffix.lower()
    media_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf", ".mp4": "video/mp4", ".mp3": "audio/mpeg"}.get(extension, "application/octet-stream")
    return FileResponse(job["result_path"], media_type=media_type, headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(job['output_name'])}", "Content-Security-Policy": "default-src 'none'; sandbox"})


class BatchRequest(BaseModel):
    jobs: list[dict] = Field(min_length=1, max_length=50)


@app.post("/api/v1/compression-jobs/batch-download", tags=["jobs"])
async def batch_download(body: BatchRequest):
    import zipfile
    from fastapi.responses import StreamingResponse
    import io
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for item in body.jobs:
            job = _job_auth(str(item.get("job_id", "")), item.get("job_token"))
            if job["status"] == "completed" and Path(job.get("result_path", "")).is_file(): archive.write(job["result_path"], job["output_name"])
    stream.seek(0)
    if stream.getbuffer().nbytes < 22: raise HTTPException(404, "No completed results were found.")
    return StreamingResponse(stream, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=smartcompress-results.zip"})


@app.get("/api/v1/formats", tags=["formats"])
async def formats():
    entries = [
        {"category": "Images", "formats": ["JPEG", "PNG", "WebP", "GIF", "BMP", "TIFF", "ICO"], "support": "Full", "note": "Pillow encoders; animated GIF retained. AVIF/HEIC require an optional Pillow codec and are disabled here."},
        {"category": "PDF", "formats": ["PDF"], "support": "Partial", "note": "PyMuPDF structural optimization. Embedded-image downsampling and OCR are not included."},
        {"category": "Video", "formats": ["MP4", "MOV", "MKV", "WebM", "AVI"], "support": "Full", "note": "FFmpeg H.264/AAC CPU encoding; output MP4. Available codecs depend on the installed FFmpeg build."},
        {"category": "Audio", "formats": ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG"], "support": "Partial", "note": "FFmpeg MP3 output; lossless audio stays transcoded at high bitrate, not source-quality restoration."},
        {"category": "Documents and archives", "formats": ["ZIP", "DOCX", "PPTX", "XLSX", "ODT", "ODS", "ODP", "EPUB"], "support": "Partial", "note": "Safe ZIP-container recompression while preserving package members; archive expansion safety limits apply."},
        {"category": "Other", "formats": ["SVG", "TAR", "GZIP", "7Z", "HEIC", "HEIF"], "support": "Unsupported", "note": "Detected where possible; a safe adapter is not enabled in this build."},
    ]
    return {"formats": entries, "limits": {"max_upload_bytes": MAX_UPLOAD, "max_concurrent_jobs": MAX_JOBS, "max_image_pixels": MAX_IMAGE_PIXELS, "retention_hours": RETENTION / 3600}}


@app.get("/api/v1/health", tags=["health"])
async def health():
    return {"status": "ok", "version": app.version, "engines": {"images": True, "pdf": True, "ffmpeg": bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))}, "limits": {"max_upload_bytes": MAX_UPLOAD, "max_concurrent_jobs": MAX_JOBS}}


@app.get("/", include_in_schema=False)
async def home():
    return FileResponse(WEB / "index.html")


app.mount("/static", StaticFiles(directory=WEB), name="static")
