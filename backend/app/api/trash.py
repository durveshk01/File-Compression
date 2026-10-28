"""Trash and Data Recovery API endpoints."""

import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.api.deps import get_current_user, get_db
from app.models.file import File
from app.models.folder import Folder
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.file import FileResponse
from app.services.file_service import FileService

router = APIRouter(prefix="/api/trash", tags=["Trash"])


@router.get("", response_model=PaginatedResponse[FileResponse])
def get_trash_items(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """List all files in trash."""
    files, total = FileService.get_files(
        db,
        user_id=current_user.id,
        trashed_only=True,
        sort_by="trashed_at",
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


@router.post("/{file_id}/restore", response_model=MessageResponse)
def restore_trashed_file(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Restore a deleted file from trash back to its location."""
    FileService.restore_file(db, file_id, current_user.id)
    return MessageResponse(message="File restored successfully.")


@router.delete("/{file_id}/permanent", response_model=MessageResponse)
async def permanently_delete_file(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Permanently delete file and purge all version objects from storage."""
    await FileService.permanent_delete_file(db, file_id, current_user.id)
    return MessageResponse(message="File permanently deleted and storage freed.")


@router.delete("/empty", response_model=MessageResponse)
async def empty_trash(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Permanently purge all items currently in trash."""
    trashed_files = db.scalars(
        select(File.id).where(File.owner_id == current_user.id, File.is_trashed.is_(True))
    ).all()
    count = 0
    for fid in trashed_files:
        try:
            await FileService.permanent_delete_file(db, fid, current_user.id)
            count += 1
        except Exception:
            continue

    # Also permanently remove trashed folders
    trashed_folders = db.scalars(
        select(Folder).where(Folder.owner_id == current_user.id, Folder.is_trashed.is_(True))
    ).all()
    for tf in trashed_folders:
        db.delete(tf)
    db.commit()

    return MessageResponse(message=f"Trash emptied. Permanently purged {count} files.")
