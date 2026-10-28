"""Unit and integration tests for file versioning and version restoration."""

import io
import pytest


def test_file_versioning_lifecycle(client, auth_headers):
    # Upload Version 1
    v1_content = b"Version 1 Content"
    up_res = client.post(
        "/api/files/upload",
        headers=auth_headers,
        files={"file": ("versioned_doc.txt", io.BytesIO(v1_content), "text/plain")},
    )
    file_id = up_res.json()["id"]

    # Upload Version 2
    v2_content = b"Version 2 Updated Content"
    v2_res = client.post(
        f"/api/files/{file_id}/versions",
        headers=auth_headers,
        files={"file": ("versioned_doc.txt", io.BytesIO(v2_content), "text/plain")},
    )
    assert v2_res.status_code == 201
    assert v2_res.json()["version_number"] == 2

    # Verify active file now returns v2 content
    dl_v2 = client.get(f"/api/files/{file_id}/download", headers=auth_headers)
    assert dl_v2.content == v2_content

    # List versions
    versions_res = client.get(f"/api/files/{file_id}/versions", headers=auth_headers)
    assert versions_res.status_code == 200
    versions = versions_res.json()
    assert len(versions) == 2
    v1_record = [v for v in versions if v["version_number"] == 1][0]

    # Restore Version 1
    restore_res = client.post(
        f"/api/files/{file_id}/versions/{v1_record['id']}/restore",
        headers=auth_headers,
    )
    assert restore_res.status_code == 200

    # Download should now yield v1 content again
    dl_restored = client.get(f"/api/files/{file_id}/download", headers=auth_headers)
    assert dl_restored.content == v1_content
