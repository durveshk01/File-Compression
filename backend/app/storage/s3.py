"""S3-compatible object storage provider (AWS S3, MinIO, Cloudflare R2)."""

import asyncio
import io
from typing import Generator

try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    Config = None
    ClientError = Exception

from app.core.config import settings
from app.storage.base import StorageProvider


class S3StorageProvider(StorageProvider):
    """Storage provider for AWS S3 and S3-compatible APIs (MinIO, R2, Ceph)."""

    def __init__(self):
        if boto3 is None:
            raise RuntimeError("boto3 is required for S3 storage. Please install with: pip install boto3")
        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Ensure bucket exists in local/test environments like MinIO."""
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchBucket"):
                try:
                    self.client.create_bucket(Bucket=self.bucket)
                except Exception:
                    pass

    async def save_file(self, storage_key: str, content: bytes) -> str:
        def _upload():
            self.client.put_object(
                Bucket=self.bucket,
                Key=storage_key,
                Body=content,
            )

        await asyncio.to_thread(_upload)
        return storage_key

    async def get_file(self, storage_key: str) -> bytes:
        def _download():
            try:
                response = self.client.get_object(Bucket=self.bucket, Key=storage_key)
                return response["Body"].read()
            except ClientError as e:
                raise FileNotFoundError(f"File not found in S3: {storage_key}") from e

        return await asyncio.to_thread(_download)

    def get_file_stream(self, storage_key: str, chunk_size: int = 65536) -> Generator[bytes, None, None]:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=storage_key)
            body = response["Body"]
            while chunk := body.read(chunk_size):
                yield chunk
        except ClientError as e:
            raise FileNotFoundError(f"File not found in S3: {storage_key}") from e

    async def delete_file(self, storage_key: str) -> bool:
        def _delete():
            try:
                self.client.delete_object(Bucket=self.bucket, Key=storage_key)
                return True
            except ClientError:
                return False

        return await asyncio.to_thread(_delete)

    async def file_exists(self, storage_key: str) -> bool:
        def _check():
            try:
                self.client.head_object(Bucket=self.bucket, Key=storage_key)
                return True
            except ClientError:
                return False

        return await asyncio.to_thread(_check)

    async def get_file_size(self, storage_key: str) -> int:
        def _size():
            try:
                response = self.client.head_object(Bucket=self.bucket, Key=storage_key)
                return response["ContentLength"]
            except ClientError as e:
                raise FileNotFoundError(f"File not found in S3: {storage_key}") from e

        return await asyncio.to_thread(_size)

    def generate_presigned_upload_url(self, storage_key: str, expires_in: int = 3600) -> str | None:
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={"Bucket": self.bucket, "Key": storage_key},
                ExpiresIn=expires_in,
            )
            return url
        except ClientError:
            return None

    def generate_presigned_download_url(self, storage_key: str, filename: str, expires_in: int = 3600) -> str | None:
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": storage_key,
                    "ResponseContentDisposition": f'attachment; filename="{filename}"',
                },
                ExpiresIn=expires_in,
            )
            return url
        except ClientError:
            return None
