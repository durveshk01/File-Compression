"""Folder schemas."""

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class BreadcrumbItem(BaseModel):
    id: uuid.UUID
    name: str


class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class FolderMoveRequest(BaseModel):
    parent_id: uuid.UUID | None = None


class FolderResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    name: str
    is_trashed: bool = False
    trashed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None
    file_count: int = 0
    subfolder_count: int = 0

    model_config = ConfigDict(from_attributes=True)
