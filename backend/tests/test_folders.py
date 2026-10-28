"""Unit and integration tests for folder operations and hierarchy."""

import io
import pytest


def test_create_and_list_folders(client, auth_headers):
    res = client.post(
        "/api/folders",
        headers=auth_headers,
        json={"name": "Documents"},
    )
    assert res.status_code == 201
    folder = res.json()
    assert folder["name"] == "Documents"
    assert folder["parent_id"] is None

    list_res = client.get("/api/folders", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_nested_folders_and_breadcrumbs(client, auth_headers):
    # Create parent
    p_res = client.post("/api/folders", headers=auth_headers, json={"name": "Projects"})
    parent_id = p_res.json()["id"]

    # Create child
    c_res = client.post(
        "/api/folders",
        headers=auth_headers,
        json={"name": "CloudVault", "parent_id": parent_id},
    )
    child_id = c_res.json()["id"]

    # Check breadcrumbs
    bc_res = client.get(f"/api/folders/{child_id}/breadcrumbs", headers=auth_headers)
    assert bc_res.status_code == 200
    bcs = bc_res.json()
    assert len(bcs) == 2
    assert bcs[0]["name"] == "Projects"
    assert bcs[1]["name"] == "CloudVault"


def test_rename_folder(client, auth_headers):
    res = client.post("/api/folders", headers=auth_headers, json={"name": "OldName"})
    folder_id = res.json()["id"]

    patch_res = client.patch(
        f"/api/folders/{folder_id}",
        headers=auth_headers,
        json={"name": "NewName"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "NewName"


def test_prevent_move_into_descendant(client, auth_headers):
    p_res = client.post("/api/folders", headers=auth_headers, json={"name": "ParentDir"})
    parent_id = p_res.json()["id"]

    c_res = client.post(
        "/api/folders",
        headers=auth_headers,
        json={"name": "ChildDir", "parent_id": parent_id},
    )
    child_id = c_res.json()["id"]

    # Try moving ParentDir into ChildDir
    move_res = client.post(
        f"/api/folders/{parent_id}/move",
        headers=auth_headers,
        json={"parent_id": child_id},
    )
    assert move_res.status_code == 400
    assert "descendant" in move_res.json()["detail"].lower()
