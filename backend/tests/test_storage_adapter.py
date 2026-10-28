"""Unit tests for the storage provider abstraction and path traversal security."""

import asyncio
import pytest
from app.storage.local import LocalStorageProvider


def test_local_storage_lifecycle(tmp_path):
    async def _test():
        provider = LocalStorageProvider(base_path=str(tmp_path))
        storage_key = "users/123/documents/sample.txt"
        content = b"Binary file storage test data"

        # Save
        saved_key = await provider.save_file(storage_key, content)
        assert saved_key == storage_key
        assert await provider.file_exists(storage_key) is True
        assert await provider.get_file_size(storage_key) == len(content)

        # Retrieve
        retrieved = await provider.get_file(storage_key)
        assert retrieved == content

        # Stream
        stream_data = b"".join(provider.get_file_stream(storage_key, chunk_size=8))
        assert stream_data == content

        # Delete
        deleted = await provider.delete_file(storage_key)
        assert deleted is True
        assert await provider.file_exists(storage_key) is False

    asyncio.run(_test())


def test_storage_path_traversal_protection(tmp_path):
    async def _test():
        provider = LocalStorageProvider(base_path=str(tmp_path))
        malicious_keys = [
            "../../etc/passwd",
            "..\\..\\windows\\system32",
            "nested/../../../secret.txt",
        ]
        for key in malicious_keys:
            with pytest.raises(ValueError, match="Path traversal"):
                await provider.save_file(key, b"exploit")

    asyncio.run(_test())
