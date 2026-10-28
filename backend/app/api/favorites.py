"""Favorites/Starred files API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.file import FileResponse
from app.services.file_service import FileService

router = APIRouter(prefix="/api/favorites", tags=["Favorites"])


@router.get("", response_model=PaginatedResponse[FileResponse])
def get_starred_files(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """List all files marked as starred/favorite by user."""
    files, total = FileService.get_files(
        db,
        user_id=current_user.id,
        starred_only=True,
        sort_by="created_at",
        sort_order="desc",
        page=page,
        page_size=page_size,
    )
    items = [FileResponse.model_validate(f) for f in files]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
