"""Unit and integration tests for file management, uploads, quota, and trash."""

import io
import pytest


def test_upload_file_success(client, auth_headers):
    file_content = b"Hello, CloudVault Secure Storage!"
    response = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("test_doc.txt", io.BytesIO(file_content), "text/plain")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "test_doc.txt"
    assert data["size_bytes"] == len(file_content)
    assert data["mime_type"] == "text/plain"
    assert data["current_version"] == 1


def test_upload_empty_file_rejected(client, auth_headers):
    response = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_download_file(client, auth_headers):
    content = b"Downloadable Content 12345"
    upload_res = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("download_me.txt", io.BytesIO(content), "text/plain")},
    )
    file_id = upload_res.json()["id"]

    download_res = client.get(f"/api/files/{file_id}/download", headers=auth_headers)
    assert download_res.status_code == 200
    assert download_res.content == content


def test_user_data_isolation(client, auth_headers, second_user_headers):
    """User B should not be able to access or download User A's private file."""
    upload_res = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("private_alice.txt", io.BytesIO(b"Secret Data"), "text/plain")},
    )
    file_id = upload_res.json()["id"]

    # User B tries to view metadata
    view_res = client.get(f"/api/files/{file_id}", headers=second_user_headers)
    assert view_res.status_code in (403, 404)

    # User B tries to download
    dl_res = client.get(f"/api/files/{file_id}/download", headers=second_user_headers)
    assert dl_res.status_code in (403, 404)


def test_rename_file(client, auth_headers):
    upload_res = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("initial_name.txt", io.BytesIO(b"Data"), "text/plain")},
    )
    file_id = upload_res.json()["id"]

    patch_res = client.patch(
        f"/api/files/{file_id}",
        headers=auth_headers,
        json={"original_filename": "renamed_file.txt"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["original_filename"] == "renamed_file.txt"


def test_star_and_unstar(client, auth_headers):
    upload_res = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("star_test.txt", io.BytesIO(b"Data"), "text/plain")},
    )
    file_id = upload_res.json()["id"]

    # Toggle star
    star_res = client.post(f"/api/files/{file_id}/favorite", headers=auth_headers)
    assert star_res.status_code == 200

    favs_res = client.get("/api/favorites", headers=auth_headers)
    assert favs_res.status_code == 200
    assert len(favs_res.json()["items"]) == 1

    # Remove star
    unstar_res = client.delete(f"/api/files/{file_id}/favorite", headers=auth_headers)
    assert unstar_res.status_code == 200


def test_soft_delete_and_restore(client, auth_headers):
    upload_res = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("to_delete.txt", io.BytesIO(b"Trash me"), "text/plain")},
    )
    file_id = upload_res.json()["id"]

    # Move to trash
    del_res = client.delete(f"/api/files/{file_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # Ensure not in active files
    active_res = client.get("/api/files", headers=auth_headers)
    assert not any(f["id"] == file_id for f in active_res.json()["items"])

    # Ensure in trash list
    trash_res = client.get("/api/trash", headers=auth_headers)
    assert any(f["id"] == file_id for f in trash_res.json()["items"])

    # Restore file
    restore_res = client.post(f"/api/trash/{file_id}/restore", headers=auth_headers)
    assert restore_res.status_code == 200

    # Verify back in active files
    active_again = client.get("/api/files", headers=auth_headers)
    assert any(f["id"] == file_id for f in active_again.json()["items"])


def test_search_and_pagination(client, auth_headers):
    for i in range(5):
        client.post(
            "/api/files/upload",
            headers=auth_headers,
            files={"file": (f"report_{i}.csv", io.BytesIO(b"col1,col2\n1,2"), "text/csv")},
        )

    # Search query
    search_res = client.get("/api/files?search=report_2", headers=auth_headers)
    assert search_res.status_code == 200
    assert search_res.json()["total"] == 1
    assert search_res.json()["items"][0]["original_filename"] == "report_2.csv"
