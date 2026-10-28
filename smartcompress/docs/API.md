# API usage

Open `/docs` for the interactive OpenAPI description. API responses never expose server filesystem paths.

## Upload and compress

Upload a file first. The client MIME type is ignored.

```powershell
$upload = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/files -Form @{ file = Get-Item .\photo.jpg }
$body = @{ upload_id = $upload.upload_id; upload_token = $upload.upload_token; target_bytes = 500000; mode = 'balanced' } | ConvertTo-Json
$job = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/compression-jobs -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($job.job_token)" }
```

Modes: `balanced`, `lossless`, `smallest`, `exact`. `target_bytes` is optional, positive, and capped at 8 GiB.

## Poll, stream, cancel and download

```powershell
Invoke-RestMethod "http://127.0.0.1:8000/api/v1/compression-jobs/$($job.job_id)" -Headers $headers
Invoke-WebRequest "http://127.0.0.1:8000/api/v1/compression-jobs/$($job.job_id)/download" -Headers $headers -OutFile .\result.jpg
Invoke-WebRequest "http://127.0.0.1:8000/api/v1/compression-jobs/$($job.job_id)/preview" -Headers $headers -OutFile .\preview.jpg
Invoke-RestMethod -Method Post "http://127.0.0.1:8000/api/v1/compression-jobs/$($job.job_id)/cancel" -Headers $headers
```

`GET /api/v1/compression-jobs/{job_id}/events` is an SSE endpoint (`event: status`) for clients that can set an Authorization header. Browser `EventSource` cannot set custom headers, so the supplied browser UI uses short-interval polling with Bearer headers.

Batch download accepts a JSON body with 1–50 `{job_id, job_token}` pairs at `POST /api/v1/compression-jobs/batch-download`. Also available: `GET /api/v1/formats`, `GET /api/v1/health`, `/openapi.json`, `/docs`, and `/redoc`.
