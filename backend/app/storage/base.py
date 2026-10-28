"""Storage provider abstract base class."""

from abc import ABC, abstractmethod
from typing import BinaryIO, Generator


class StorageProvider(ABC):
    """Abstract interface for file storage backends."""

    @abstractmethod
    async def save_file(self, storage_key: str, content: bytes) -> str:
        """Save file bytes to storage backend and return storage key."""
        pass

    @abstractmethod
    async def get_file(self, storage_key: str) -> bytes:
        """Retrieve raw file bytes from storage."""
        pass

    @abstractmethod
    def get_file_stream(self, storage_key: str, chunk_size: int = 65536) -> Generator[bytes, None, None]:
        """Yield chunks of file data for streaming."""
        pass

    @abstractmethod
    async def delete_file(self, storage_key: str) -> bool:
        """Delete file from storage."""
        pass

    @abstractmethod
    async def file_exists(self, storage_key: str) -> bool:
        """Check if file exists in storage."""
        pass

    @abstractmethod
    async def get_file_size(self, storage_key: str) -> int:
        """Get file size in bytes."""
        pass

    @abstractmethod
    def generate_presigned_upload_url(self, storage_key: str, expires_in: int = 3600) -> str | None:
        """Generate presigned upload URL if supported."""
        pass

    @abstractmethod
    def generate_presigned_download_url(self, storage_key: str, filename: str, expires_in: int = 3600) -> str | None:
        """Generate presigned download URL if supported."""
        pass
