"""Dashboard and Storage API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import DashboardStatsResponse, StorageUsageResponse
from app.schemas.file import FileResponse
from app.services.dashboard_service import DashboardService
from app.services.file_service import FileService

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve aggregate statistics, file breakdown, and recent items for user."""
    return DashboardService.get_dashboard_stats(db, current_user)


@router.get("/dashboard/recent", response_model=list[FileResponse])
def get_recent_files(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve most recently uploaded files."""
    files, _ = FileService.get_files(
        db,
        user_id=current_user.id,
        sort_by="created_at",
        sort_order="desc",
        page=1,
        page_size=10,
    )
    return [FileResponse.model_validate(f) for f in files]


@router.get("/storage/usage", response_model=StorageUsageResponse)
def get_storage_usage(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get current user storage quota and usage."""
    return DashboardService.get_storage_usage(current_user)
