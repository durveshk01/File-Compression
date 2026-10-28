"""Unit and integration tests for authentication workflows."""

import pytest


def test_registration_success(client):
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Alice Developer",
            "email": "alice@cloudvault.com",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "alice@cloudvault.com"
    assert data["full_name"] == "Alice Developer"
    assert "password" not in data
    assert "password_hash" not in data


def test_registration_duplicate_email(client):
    payload = {
        "full_name": "Alice Developer",
        "email": "duplicate@cloudvault.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
    }
    client.post("/api/auth/register", json=payload)
    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_registration_password_mismatch(client):
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Bob",
            "email": "bob@cloudvault.com",
            "password": "Password123!",
            "confirm_password": "DifferentPassword123!",
        },
    )
    assert res.status_code == 422


def test_login_success(client):
    client.post(
        "/api/auth/register",
        json={
            "full_name": "Carol",
            "email": "carol@cloudvault.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    res = client.post(
        "/api/auth/login",
        json={"email": "carol@cloudvault.com", "password": "Password123!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client):
    res = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@cloudvault.com", "password": "WrongPassword123!"},
    )
    assert res.status_code == 401


def test_get_current_user_profile(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "testuser@cloudvault.com"


def test_protected_route_unauthenticated(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_change_password(client, auth_headers):
    res = client.post(
        "/api/auth/change-password",
        headers=auth_headers,
        json={
            "current_password": "Password123!",
            "new_password": "NewPassword456!",
            "confirm_password": "NewPassword456!",
        },
    )
    assert res.status_code == 200
    # Try logging in with new password
    res_login = client.post(
        "/api/auth/login",
        json={"email": "testuser@cloudvault.com", "password": "NewPassword456!"},
    )
    assert res_login.status_code == 200
