"""Dashboard and Storage schemas."""

import uuid
from pydantic import BaseModel
from app.schemas.file import FileResponse
from app.schemas.activity import ActivityResponse


class StorageUsageResponse(BaseModel):
    quota_bytes: int
    used_bytes: int
    available_bytes: int
    used_percentage: float


class FileTypeStat(BaseModel):
    category: str
    count: int
    size_bytes: int


class DashboardStatsResponse(BaseModel):
    total_files: int
    total_folders: int
    storage_used_bytes: int
    storage_quota_bytes: int
    shared_files_count: int
    starred_files_count: int
    trash_files_count: int
    file_type_distribution: list[FileTypeStat]
    recent_files: list[FileResponse]
    recent_activities: list[ActivityResponse]
