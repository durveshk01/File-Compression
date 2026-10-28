"""Local filesystem storage provider."""

import asyncio
import os
from pathlib import Path
from typing import Generator

from app.core.config import settings
from app.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    """Storage provider saving files to local disk with path traversal protection."""

    def __init__(self, base_path: str | None = None):
        self.base_path = Path(base_path or settings.LOCAL_STORAGE_PATH).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, storage_key: str) -> Path:
        """Safely resolve storage key to an absolute path inside base_path."""
        clean_key = storage_key.lstrip("/\\")
        target_path = (self.base_path / clean_key).resolve()
        if not str(target_path).startswith(str(self.base_path)):
            raise ValueError(f"Path traversal detected: {storage_key}")
        return target_path

    async def save_file(self, storage_key: str, content: bytes) -> str:
        target_path = self._resolve_path(storage_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        def _write():
            with open(target_path, "wb") as f:
                f.write(content)

        await asyncio.to_thread(_write)
        return storage_key

    async def get_file(self, storage_key: str) -> bytes:
        target_path = self._resolve_path(storage_key)
        if not target_path.exists():
            raise FileNotFoundError(f"File not found: {storage_key}")

        def _read():
            with open(target_path, "rb") as f:
                return f.read()

        return await asyncio.to_thread(_read)

    def get_file_stream(self, storage_key: str, chunk_size: int = 65536) -> Generator[bytes, None, None]:
        target_path = self._resolve_path(storage_key)
        if not target_path.exists():
            raise FileNotFoundError(f"File not found: {storage_key}")
        with open(target_path, "rb") as f:
            while chunk := f.read(chunk_size):
                yield chunk

    async def delete_file(self, storage_key: str) -> bool:
        target_path = self._resolve_path(storage_key)
        if not target_path.exists():
            return False

        def _remove():
            target_path.unlink()
            return True

        return await asyncio.to_thread(_remove)

    async def file_exists(self, storage_key: str) -> bool:
        target_path = self._resolve_path(storage_key)
        return await asyncio.to_thread(target_path.exists)

    async def get_file_size(self, storage_key: str) -> int:
        target_path = self._resolve_path(storage_key)
        if not target_path.exists():
            raise FileNotFoundError(f"File not found: {storage_key}")
        return await asyncio.to_thread(lambda: target_path.stat().st_size)

    def generate_presigned_upload_url(self, storage_key: str, expires_in: int = 3600) -> str | None:
        return None

    def generate_presigned_download_url(self, storage_key: str, filename: str, expires_in: int = 3600) -> str | None:
        return None
