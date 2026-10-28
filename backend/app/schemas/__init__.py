"""Schemas package."""

from app.schemas.common import ErrorResponse, MessageResponse, PaginatedResponse
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.file import (
    BulkActionRequest,
    FileCopyRequest,
    FileMoveRequest,
    FileResponse,
    FileUpdate,
    FileUploadResponse,
    FileVersionResponse,
    UploadCompleteRequest,
    UploadInitiateRequest,
    UploadInitiateResponse,
)
from app.schemas.folder import (
    BreadcrumbItem,
    FolderCreate,
    FolderMoveRequest,
    FolderResponse,
    FolderUpdate,
)
from app.schemas.share import (
    FileShareCreate,
    FileShareResponse,
    ShareLinkCreate,
    ShareLinkPublicResponse,
    ShareLinkResponse,
    ShareLinkVerifyRequest,
)
from app.schemas.tag import FileTagRequest, TagCreate, TagResponse
from app.schemas.activity import ActivityResponse
from app.schemas.notification import NotificationResponse, NotificationUpdate
from app.schemas.dashboard import DashboardStatsResponse, FileTypeStat, StorageUsageResponse

__all__ = [
    "ActivityResponse",
    "BreadcrumbItem",
    "BulkActionRequest",
    "ChangePasswordRequest",
    "DashboardStatsResponse",
    "ErrorResponse",
    "FileCopyRequest",
    "FileMoveRequest",
    "FileResponse",
    "FileShareCreate",
    "FileShareResponse",
    "FileTagRequest",
    "FileTypeStat",
    "FileUpdate",
    "FileUploadResponse",
    "FileVersionResponse",
    "FolderCreate",
    "FolderMoveRequest",
    "FolderResponse",
    "FolderUpdate",
    "LoginRequest",
    "MessageResponse",
    "NotificationResponse",
    "NotificationUpdate",
    "PaginatedResponse",
    "RefreshTokenRequest",
    "RegisterRequest",
    "ShareLinkCreate",
    "ShareLinkPublicResponse",
    "ShareLinkResponse",
    "ShareLinkVerifyRequest",
    "StorageUsageResponse",
    "TagCreate",
    "TagResponse",
    "TokenResponse",
    "UploadCompleteRequest",
    "UploadInitiateRequest",
    "UploadInitiateResponse",
    "UserResponse",
    "UserUpdate",
]
