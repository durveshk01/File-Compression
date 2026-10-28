# Deployment and troubleshooting

## Local development

Use Python 3.11 or later. In the Windows setup below, FFmpeg is optional unless media formats are needed.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn services.compressor.api:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000`; API docs are at `/docs`.

Linux: create and activate a Python virtual environment, install `requirements-dev.txt`, install `ffmpeg` from the OS package manager if you need media support, then run the same Uvicorn module command.

## Locked install

The development lock is `uv.lock`. Runtime Python dependencies with package hashes are exported to `requirements.lock` for the container build. `uv lock --locked` checks that `pyproject.toml` and `uv.lock` agree. `uv export --locked --format requirements-txt --no-dev --output-file requirements.lock` refreshes the runtime lock after dependency changes.

## Container

```powershell
docker compose up --build
```

Compose binds to localhost only and stores temporary files in a named volume. For a public deployment, add HTTPS termination, exact production CORS origins, edge rate limiting, storage quotas, isolated least-privilege worker containers, monitoring, and a retention policy. The sample in-memory state does not support multiple replicas.

## Render free plan

The root `render.yaml` defines a Singapore free Docker web service. It builds the included Dockerfile with FFmpeg and binds the injected `PORT`. Free-plan limits are 64 MB per upload, 16 megapixels per image, and one simultaneous job. Render's filesystem is ephemeral and free web services spin down after 15 minutes idle. Files, results, and job tokens can disappear on sleep, restart, or redeploy before the retention timer. Free resources share workspace instance-hour, bandwidth and build limits; supplemental bandwidth/build usage may be billed when a payment method is on file. This configuration uses no paid plans, disks, databases, or add-ons.

## Environment settings

| Variable | Default | Notes |
| --- | --- | --- |
| `SMARTCOMPRESS_DATA_DIR` | `.smartcompress-data` | Keep outside the public static tree and on private storage. |
| `SMARTCOMPRESS_MAX_UPLOAD_MB` | `256` | Per-file body cap. |
| `SMARTCOMPRESS_RETENTION_HOURS` | `2` | Startup and periodic cleanup policy. |
| `SMARTCOMPRESS_MAX_JOBS` | `2` | Concurrent CPU jobs per process. |
| `SMARTCOMPRESS_JOB_TIMEOUT_SECONDS` | `900` | Media/worker ceiling. |
| `SMARTCOMPRESS_CORS_ORIGINS` | `http://localhost:8000` | Comma-separated exact browser origins. |

## Troubleshooting

- **Media uploads are rejected:** install FFmpeg and ensure both `ffmpeg` and `ffprobe` resolve from the same shell that starts Uvicorn; inspect `/api/v1/health`.
- **Media encoding fails:** verify your FFmpeg build includes `libx264`, AAC and `libmp3lame`; try a short local clip and confirm disk space.
- **PDF password prompt:** decrypt the PDF yourself and upload the unlocked copy; the service does not collect passwords.
- **Target not reached:** the response contains measured actual bytes. The limit may conflict with minimum bitrate, source complexity, lossless constraints or supported operations.
- **Unsupported type or mismatch:** rename the file only if its actual content is that format. Changing an extension does not convert data.
- **Upload or job expired:** files and in-memory job tokens expire after the configured retention; upload again. Restarting the process also invalidates tokens.
- **CORS failure:** use the same origin as the frontend or set the exact UI origin in `SMARTCOMPRESS_CORS_ORIGINS`.
