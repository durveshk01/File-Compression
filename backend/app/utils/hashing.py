"""Hashing and token utilities."""

import hashlib
import secrets


def calculate_sha256(content: bytes) -> str:
    """Calculate SHA256 hex digest of bytes."""
    return hashlib.sha256(content).hexdigest()


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a URL-safe random token."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Hash a token using SHA256 for secure storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
