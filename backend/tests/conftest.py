"""Pytest configuration and fixtures with SQLite test database."""

import os
import sys
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.storage.local import LocalStorageProvider
from app.storage import get_storage_provider

# Use in-memory SQLite database for fast, isolated tests
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    temp_dir = tempfile.TemporaryDirectory()
    settings.LOCAL_STORAGE_PATH = temp_dir.name
    settings.STORAGE_BACKEND = "local"
    get_storage_provider.cache_clear()
    yield
    temp_dir.cleanup()


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Register and log in a standard test user, returning auth Bearer headers."""
    reg_data = {
        "full_name": "Test User",
        "email": "testuser@cloudvault.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    client.post("/api/auth/register", json=reg_data)
    login_resp = client.post(
        "/api/auth/login",
        json={"email": reg_data["email"], "password": reg_data["password"]},
    )
    tokens = login_resp.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def second_user_headers(client):
    """Register and log in a second isolated user for testing authorization isolation."""
    reg_data = {
        "full_name": "Second User",
        "email": "second@cloudvault.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    client.post("/api/auth/register", json=reg_data)
    login_resp = client.post(
        "/api/auth/login",
        json={"email": reg_data["email"], "password": reg_data["password"]},
    )
    tokens = login_resp.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
