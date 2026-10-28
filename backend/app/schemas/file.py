"""File and FileVersion schemas."""

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.tag import TagResponse


class FileResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    folder_id: uuid.UUID | None = None
    original_filename: str
    storage_key: str
    mime_type: str | None = None
    size_bytes: int
    checksum: str | None = None
    is_trashed: bool = False
    trashed_at: datetime | None = None
    is_starred: bool = False
    current_version: int = 1
    created_at: datetime
    updated_at: datetime | None = None
    tags: list[TagResponse] = []

    model_config = ConfigDict(from_attributes=True)


class FileUpdate(BaseModel):
    original_filename: str | None = Field(None, min_length=1, max_length=255)
    folder_id: uuid.UUID | None = None
    is_starred: bool | None = None


class FileUploadResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    size_bytes: int
    mime_type: str | None
    storage_key: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileMoveRequest(BaseModel):
    folder_id: uuid.UUID | None = None


class FileCopyRequest(BaseModel):
    folder_id: uuid.UUID | None = None
    new_name: str | None = None


class BulkActionRequest(BaseModel):
    file_ids: list[uuid.UUID]
    action: str = Field(..., description="delete, restore, move, star, unstar, permanent_delete")
    folder_id: uuid.UUID | None = None


class FileVersionResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    version_number: int
    storage_key: str
    size_bytes: int
    checksum: str | None
    uploaded_by: uuid.UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UploadInitiateRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    size_bytes: int = Field(..., gt=0)
    mime_type: str | None = None
    folder_id: uuid.UUID | None = None


class UploadInitiateResponse(BaseModel):
    upload_id: str
    storage_key: str
    upload_url: str | None = None
    part_size: int = 5 * 1024 * 1024


class UploadCompleteRequest(BaseModel):
    upload_id: str
    storage_key: str
    filename: str
    size_bytes: int
    mime_type: str | None = None
    folder_id: uuid.UUID | None = None
    checksum: str | None = None
