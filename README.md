# SmartCompress

SmartCompress is a format-aware file compressor with a responsive browser UI and a versioned FastAPI service. It checks file content, runs bounded format-specific encoders, measures actual output bytes, and preserves the uploaded original. Processing artifacts live in a private temporary data folder and are removed after the configured retention period.

## Run on Windows

Requirements: Python 3.11+ (tested with 3.12), FFmpeg with `ffmpeg` and `ffprobe` on `PATH` for media conversion. Pillow, PyMuPDF, FastAPI, and Uvicorn are Python dependencies. No Node.js, database, Redis, Ghostscript, or qpdf is required.

```powershell
cd D:\Project\Files_Compression
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
python -m uvicorn services.compressor.api:app --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Swagger is at `/docs`, the alternative API reference at `/redoc`, and the OpenAPI JSON at `/openapi.json`.

Install FFmpeg with `winget install Gyan.FFmpeg.Shared` if it is not already installed; reopen the terminal after installation and check `ffmpeg -version` and `ffprobe -version`. Image and PDF features still work without it; `/api/v1/health` reports engine availability.

## Run on Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
sudo apt-get update && sudo apt-get install -y ffmpeg
uvicorn services.compressor.api:app --host 127.0.0.1 --port 8000
```

For a public deployment, terminate HTTPS at a trusted reverse proxy, set `SMARTCOMPRESS_CORS_ORIGINS` to the exact site origin, run the worker in a restricted container, cap storage and worker concurrency, and set a retention policy appropriate to your service. Do not expose the temporary data directory through a web server. This local-first app does not provide accounts or persistent object storage.

## Configuration

`.env.example` documents available settings. Configure them in the shell or deployment environment; the app intentionally does not parse `.env` automatically.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SMARTCOMPRESS_DATA_DIR` | `.smartcompress-data` | Private temporary upload and result root |
| `SMARTCOMPRESS_MAX_UPLOAD_MB` | `256` | Per-file upload cap |
| `SMARTCOMPRESS_RETENTION_HOURS` | `2` | Automatic cleanup window |
| `SMARTCOMPRESS_MAX_JOBS` | `2` | Concurrent compression workers |
| `SMARTCOMPRESS_JOB_TIMEOUT_SECONDS` | `900` | Processing timeout |
| `SMARTCOMPRESS_CORS_ORIGINS` | `http://localhost:8000` | Exact allowed browser origins, comma-separated |

## Features and format limits

| Category | Formats | Status and behavior |
| --- | --- | --- |
| Images | JPEG, PNG, WebP, GIF, BMP, TIFF, ICO | Pillow-backed. JPEG/WebP quality candidates and bounded image downscaling try a target; PNG has lossless optimization. GIF animation is retained, but palette/color changes may occur in lossy mode. BMP/TIFF/ICO become PNG. Lossless mode retains animated images and JPEG/WebP unchanged. |
| PDF | PDF | PyMuPDF garbage collection and deflate rewrite; validates page count. Text, links and vector content are not rasterized. Embedded images are not downsampled/recompressed. Encrypted and malformed PDFs fail safely. |
| Video | MP4, MOV, MKV, WebM, AVI | FFmpeg CPU H.264/AAC output in MP4. Reports source codec; conversion is lossy. Codec availability depends on the FFmpeg build. |
| Audio | MP3, WAV, FLAC, M4A, AAC, OGG | FFmpeg MP3 output; conversion is lossy. Lossless-only mode keeps the original unchanged. |
| ZIP packages | ZIP, DOCX, PPTX, XLSX, ODT, ODS, ODP, EPUB | Repackages ZIP members with DEFLATE while preserving entry paths and bytes. Password-protected archives are rejected. Safety caps limit member count, individual expanded member size and total expanded size. |
| Detected but unavailable | SVG, TAR, GZIP, 7Z, AVIF, HEIC/HEIF, WMA and proprietary formats | No safe adapter enabled. Such files are not claimed as compressible. Install optional codecs/adapters only after reviewing their security and format-preservation behavior. |

Format detection uses signatures and container parsing for images, PDF, ZIP and Office packages, plus media probing during encode. Extension mismatches are rejected. Client MIME values are ignored. Inputs over 80 megapixels, oversized archives, malformed media, or encrypted PDFs receive actionable errors. ZIP entries are never extracted to the filesystem.

## Target-size behavior

The shared controller measures actual bytes and never pads, truncates, or replaces an original. Image compression tries quality levels and, for difficult targets, progressively smaller dimensions within five bounded scale candidates. The first valid candidate at or under target is returned; otherwise the smallest valid candidate is returned with a clear explanation. Exact mode succeeds only when the measured byte count equals the requested count. For video and audio, the target becomes a bitrate budget and FFmpeg adjusts through up to five bounded candidates; container overhead, minimum encoder bitrates, and codec behavior can prevent reaching it. PDF/package rewrites are lossless and do not degrade content to force a target. A target above the source size skips compression. “Smallest size” prefers lower image qualities; other lossy settings can still be needed for targets. Iteration counts reflect candidates evaluated.

The implementation does not claim that all file types can hit arbitrary target sizes. It returns the best valid output it found, even if a difficult target is missed. Lossless mode preserves source image data where re-encoding would alter it; audio/video are returned unchanged because no verified lossless remux path is configured.

## API

All routes are versioned under `/api/v1` and documented by the live OpenAPI schema.

1. `POST /files` accepts multipart field `file`. The response contains a random `upload_id` and scoped `upload_token`.
2. `POST /compression-jobs` accepts JSON `{ "upload_id": "…", "upload_token": "…", "target_bytes": 500000, "mode": "balanced" }`. Modes: `balanced`, `lossless`, `smallest`, `exact`.
3. Poll `GET /compression-jobs/{job_id}` or subscribe to `/compression-jobs/{job_id}/events` (Server-Sent Events) using the `Authorization: Bearer <job_token>` header.
4. `POST /compression-jobs/{job_id}/cancel` with the same header requests cancellation. FFmpeg checks cancellation while processing; short Pillow/PDF/archive operations are checked at phase boundaries.
5. Download a completed result from `GET /compression-jobs/{job_id}/download` with the same header. The unguessable per-job token scopes access. Batch download accepts `{ "jobs": [{ "job_id": "…", "job_token": "…" }] }` at `/compression-jobs/batch-download`.
6. `GET /formats` reports the engine matrix; `GET /health` reports readiness.

Files and job tokens are kept in process memory; restart invalidates tokens and removes expired artifacts. Use a durable queue, shared state store and object store before running multiple web processes or deploying a multi-host service. There is an in-process per-IP request cap and per-file size cap; public services should also add proxy-level abuse protection, persistent quotas and isolated worker containers. The application never executes uploaded files and subprocesses use argument arrays with `shell=False`.

## Development and tests

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m compileall services tests
```

Tests use generated local fixtures; they do not fetch public sample files. FFmpeg media integration is reported by `/health`; the engine's media adapter requires the installed FFmpeg/ffprobe pair. A browser-level end-to-end suite and performance benchmark dataset are not included yet. Keep tests out of production deployment images if desired.

## Architecture

```text
apps/web/                 static accessible UI, no framework runtime
services/compressor/api.py  FastAPI routes, scoped temporary jobs, cleanup
services/compressor/engine.py signature detection and format adapters
tests/                    generated-fixture engine and API tests
```

The UI uses a same-origin versioned API, so the compressor is independent of the browser. Upload uses streaming multipart reads and a 1 MiB write loop; output download streams through `FileResponse`. Long CPU operations run in a bounded thread pool behind a concurrency semaphore. Job status, cancellation and SSE are backed by in-process state; run one API process only until that state is moved to a shared store.

Detailed references: [architecture](docs/ARCHITECTURE.md), [formats](docs/FORMATS.md), [API usage](docs/API.md), and [deployment and troubleshooting](docs/DEPLOYMENT.md).

## Mobile and desktop path

- **Android/iOS:** build a React Native/Expo client that reuses the versioned API contract; upload with multipart, poll/SSE for job state, then save the returned download. The current browser app is not a native app. A local-only mobile mode needs native bindings for each codec, secure temporary storage, OS file-provider integration, memory limits and platform testing.
- **Desktop:** wrap the static web UI in Tauri and point it at a local service or remote HTTPS backend. For offline local use, package the Python service and FFmpeg as signed platform-specific sidecars, set a private per-user temp directory, and implement installer/update/signing workflows. Alternatively, a Capacitor shell can host a remote or embedded web client, but it does not itself package the compression engine.
- **Remote backend:** replace in-memory job/upload registries with durable job state and private object storage, provision a worker queue, per-user authorization, HTTPS, storage quotas and deletion jobs. Keep the request/response schema and format adapters stable across clients.

## Privacy and security notes

Temporary files are kept on the server hosting this app and deleted after two hours by default, including on periodic cleanup and a cleanup pass at startup. Do not put secrets or personal files in the repository. Uploads are not logged; filenames are sanitized for downloads. The sample server is suitable for local development. For untrusted public traffic, use an unprivileged isolated worker/container with CPU, memory, file descriptor and disk quotas; restrict outbound network, enforce TLS and retention policy, monitor storage, and apply rate limits at the edge.
#   F i l e - C o m p r e s s i o n  
 