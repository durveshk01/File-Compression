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

Batch download validates every selected token and rejects unavailable or unfinished
results with HTTP 409. Duplicate filenames become `name (2).ext`, `name (3).ext`,
and so on. ZIP generation runs outside the event loop and uses temporary disk
storage; it does not hold the whole batch in RAM. The temporary ZIP is deleted
after the response is sent. Job/upload IDs and tokens never appear in CSV exports.

`target_bytes: null` asks the engine to choose a size automatically. A target equal
to or larger than the original is already reached in non-exact modes. Exact mode
reports success only for equal measured byte counts. Outputs that would be larger
than the source return the original unchanged. `/formats` reports unavailable
media engines rather than advertising media conversion as ready.
