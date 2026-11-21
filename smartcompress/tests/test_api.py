import io
import asyncio
import threading
import time
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from services.compressor import api


def jpg_bytes():
    buffer = io.BytesIO(); Image.new("RGB", (160, 120), (180, 90, 50)).save(buffer, "JPEG", quality=95)
    return buffer.getvalue()


def test_upload_job_status_and_download(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.uploads.clear(); api.jobs.clear()
    with TestClient(api.app) as client:
        upload = client.post("/api/v1/files", files={"file": ("photo.jpg", jpg_bytes(), "image/jpeg")})
        assert upload.status_code == 201
        data = upload.json(); assert data["format"] == "JPEG"
        job = client.post("/api/v1/compression-jobs", json={"upload_id": data["upload_id"], "upload_token": data["upload_token"], "target_bytes": 50000, "mode": "balanced"})
        assert job.status_code == 202
        auth = job.json(); headers = {"Authorization": f"Bearer {auth['job_token']}"}; status = client.get(f"/api/v1/compression-jobs/{auth['job_id']}", headers=headers)
        assert status.status_code == 200 and status.json()["status"] == "completed"
        result = client.get(f"/api/v1/compression-jobs/{auth['job_id']}/download", headers=headers)
        assert result.status_code == 200 and len(result.content) > 100
        preview = client.get(f"/api/v1/compression-jobs/{auth['job_id']}/preview", headers=headers)
        assert preview.status_code == 200 and preview.headers["content-type"].startswith("image/jpeg")
        assert preview.headers["x-frame-options"] == "SAMEORIGIN"
        assert "frame-ancestors 'self'" in preview.headers["content-security-policy"]
        assert "sandbox" in preview.headers["content-security-policy"]


def test_invalid_scoped_token_does_not_reveal_job(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.jobs.clear()
    with TestClient(api.app) as client:
        response = client.get("/api/v1/compression-jobs/0", headers={"Authorization": "Bearer bad"})
        assert response.status_code == 404


def test_format_and_health_endpoints():
    with TestClient(api.app) as client:
        assert client.get("/api/v1/health").json()["status"] == "ok"
        assert len(client.get("/api/v1/formats").json()["formats"]) >= 4
        assert client.get("/docs").status_code == 200


def test_upload_enforces_extension_content_match(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.uploads.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/v1/files", files={"file": ("notes.pdf", jpg_bytes(), "application/pdf")})
        assert response.status_code == 422


def test_corrupt_image_upload_returns_validation_error(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.uploads.clear()
    buffer = io.BytesIO(); Image.new("RGB", (8, 8), (40, 80, 120)).save(buffer, "PNG")
    broken = bytearray(buffer.getvalue())
    # Corrupt the IDAT checksum while preserving the PNG signature.
    broken[-5] ^= 0xFF
    with TestClient(api.app) as client:
        response = client.post("/api/v1/files", files={"file": ("broken.png", bytes(broken), "image/png")})
    assert response.status_code == 422
    assert "damaged" in response.json()["detail"].lower()


def test_batch_download_contains_completed_results(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.uploads.clear(); api.jobs.clear()
    with TestClient(api.app) as client:
        pairs = []
        for n in range(2):
            uploaded = client.post("/api/v1/files", files={"file": (f"photo{n}.jpg", jpg_bytes(), "image/jpeg")}).json()
            job = client.post("/api/v1/compression-jobs", json={"upload_id": uploaded["upload_id"], "upload_token": uploaded["upload_token"], "mode": "balanced"}).json()
            pairs.append({"job_id": job["job_id"], "job_token": job["job_token"]})
        batch = client.post("/api/v1/compression-jobs/batch-download", json={"jobs": pairs})
        assert batch.status_code == 200
        with zipfile.ZipFile(io.BytesIO(batch.content)) as archive: assert len(archive.namelist()) == 2


def test_queued_job_cancellation(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.uploads.clear(); api.jobs.clear()
    async def leave_queued(*args, **kwargs): return None
    monkeypatch.setattr(api, "_process", leave_queued)
    with TestClient(api.app) as client:
        uploaded = client.post("/api/v1/files", files={"file": ("cancel.jpg", jpg_bytes(), "image/jpeg")}).json()
        created = client.post("/api/v1/compression-jobs", json={"upload_id": uploaded["upload_id"], "upload_token": uploaded["upload_token"]}).json()
        headers = {"Authorization": f"Bearer {created['job_token']}"}
        cancelled = client.post(f"/api/v1/compression-jobs/{created['job_id']}/cancel", headers=headers)
        assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"


def test_worker_semaphore_caps_concurrent_jobs(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    monkeypatch.setattr(api, "locks", asyncio.Semaphore(2))
    active = 0; peak = 0; mutex = threading.Lock()
    def fake_compress(src, filename, outdir, target, mode, timeout, cancelled):
        nonlocal active, peak
        with mutex: active += 1; peak = max(peak, active)
        time.sleep(.04)
        path = outdir / (src.stem + ".jpg"); path.write_bytes(b"valid-ish result")
        with mutex: active -= 1
        return {"path": str(path), "format": "JPEG", "message": "fixture", "warnings": [], "target_reached": True, "iterations": 1}
    monkeypatch.setattr(api, "compress", fake_compress)
    async def run_all():
        tasks = []
        for i in range(5):
            job_id = f"job{i}"; source = tmp_path / f"src{i}.bin"; source.write_bytes(b"x")
            upload = {"path": str(source), "filename": f"src{i}.jpg", "size": 1}
            api.jobs[job_id] = {"id": job_id, "token": "x", "status": "queued", "created_at": time.time(), "cancel": threading.Event(), "filename": upload["filename"], "size": 1}
            tasks.append(api._process(job_id, upload, None, "balanced"))
        await asyncio.gather(*tasks)
    asyncio.run(run_all())
    assert peak == 2
    assert all(api.jobs[f"job{i}"]["status"] == "completed" for i in range(5))


def test_startup_cleanup_removes_expired_temp_folders(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    monkeypatch.setattr(api, "RETENTION", 1)
    old = tmp_path / "expired"; old.mkdir(); (old / "source.bin").write_bytes(b"old")
    then = time.time() - 10; import os; os.utime(old, (then, then))
    with TestClient(api.app): pass
    assert not old.exists()


def test_batch_download_rejects_unfinished_jobs(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.jobs.clear()
    async def leave_queued(*args, **kwargs): return None
    monkeypatch.setattr(api, "_process", leave_queued)
    with TestClient(api.app) as client:
        uploaded = client.post("/api/v1/files", files={"file": ("queued.jpg", jpg_bytes(), "image/jpeg")}).json()
        created = client.post("/api/v1/compression-jobs", json={"upload_id": uploaded["upload_id"], "upload_token": uploaded["upload_token"]}).json()
        response = client.post("/api/v1/compression-jobs/batch-download", json={"jobs": [{"job_id": created["job_id"], "job_token": created["job_token"]}]})
        assert response.status_code == 409


def test_batch_download_disambiguates_duplicate_filenames(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.jobs.clear()
    with TestClient(api.app) as client:
        pairs = []
        payloads = [jpg_bytes(), jpg_bytes() + b"padding"]
        for payload in payloads:
            uploaded = client.post("/api/v1/files", files={"file": ("same.jpg", payload, "image/jpeg")}).json()
            created = client.post("/api/v1/compression-jobs", json={"upload_id": uploaded["upload_id"], "upload_token": uploaded["upload_token"], "mode": "lossless"}).json()
            pairs.append({"job_id": created["job_id"], "job_token": created["job_token"]})
        response = client.post("/api/v1/compression-jobs/batch-download", json={"jobs": pairs})
        assert response.status_code == 200
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            assert archive.namelist() == ["same.jpg", "same (2).jpg"]
            assert [archive.read(name) for name in archive.namelist()] == payloads


def test_completed_original_is_owned_by_result_directory(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.jobs.clear()
    with TestClient(api.app) as client:
        uploaded = client.post("/api/v1/files", files={"file": ("keep.jpg", jpg_bytes(), "image/jpeg")}).json()
        created = client.post("/api/v1/compression-jobs", json={"upload_id": uploaded["upload_id"], "upload_token": uploaded["upload_token"], "mode": "lossless"}).json()
        assert Path(api.jobs[created["job_id"]]["result_path"]).parent == tmp_path / created["job_id"] / "result"


def test_retention_does_not_remove_processing_source(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    monkeypatch.setattr(api, "RETENTION", 1)
    api.jobs.clear(); api.uploads.clear()
    old = tmp_path / "active"; old.mkdir(); source = old / "source.bin"; source.write_bytes(b"active")
    then = time.time() - 10
    import os; os.utime(old, (then, then))
    api.jobs["active-job"] = {"status": "processing", "source_path": str(source), "created_at": then}
    with TestClient(api.app):
        assert source.exists()
    api.jobs.clear()


def test_formats_reports_unavailable_media_engines(monkeypatch):
    monkeypatch.setattr(api.shutil, "which", lambda name: None)
    with TestClient(api.app) as client:
        entries = client.get("/api/v1/formats").json()["formats"]
        assert all(entry["support"] == "Unavailable" for entry in entries if entry["category"] in {"Video", "Audio"})


def test_batch_invalid_token_type_returns_validation_error():
    with TestClient(api.app) as client:
        response = client.post("/api/v1/compression-jobs/batch-download", json={"jobs": [{"job_id": "a" * 32, "job_token": 123}]})
        assert response.status_code == 422


def test_empty_upload_is_rejected_without_leaving_artifacts(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DATA", tmp_path)
    api.uploads.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/v1/files", files={"file": ("empty.png", b"", "image/png")})
        assert response.status_code == 400
        assert not list(tmp_path.iterdir())
        assert not api.uploads


def test_polling_does_not_use_mutation_request_quota(monkeypatch):
    api.ip_events.clear()
    with TestClient(api.app) as client:
        for _ in range(121):
            assert client.get("/api/v1/health").status_code == 200
        assert not api.ip_events


def test_api_docs_allow_their_required_assets_only_on_docs_routes():
    with TestClient(api.app) as client:
        docs = client.get("/docs")
        assert "https://cdn.jsdelivr.net" in docs.headers["content-security-policy"]
        assert "https://cdn.jsdelivr.net" not in client.get("/").headers["content-security-policy"]
