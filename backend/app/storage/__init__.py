"""Storage module factory."""

from functools import lru_cache
from app.core.config import settings
from app.storage.base import StorageProvider
from app.storage.local import LocalStorageProvider


@lru_cache()
def get_storage_provider() -> StorageProvider:
    """Return configured storage provider singleton."""
    if settings.STORAGE_BACKEND == "s3":
        from app.storage.s3 import S3StorageProvider
        return S3StorageProvider()
    return LocalStorageProvider()


__all__ = ["StorageProvider", "LocalStorageProvider", "get_storage_provider"]
