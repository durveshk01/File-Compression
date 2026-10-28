"""Folder API endpoints."""

import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.folder import (
    BreadcrumbItem,
    FolderCreate,
    FolderMoveRequest,
    FolderResponse,
    FolderUpdate,
)
from app.services.folder_service import FolderService

router = APIRouter(prefix="/api/folders", tags=["Folders"])


@router.get("", response_model=list[FolderResponse])
def list_folders(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    parent_id: uuid.UUID | None = Query(None),
):
    """List folders in a parent folder (or root if parent_id is null)."""
    folders = FolderService.get_user_folders(db, current_user.id, parent_id=parent_id)
    result = []
    for f in folders:
        f_count, sf_count = FolderService.get_folder_counts(db, f.id, current_user.id)
        resp = FolderResponse.model_validate(f)
        resp.file_count = f_count
        resp.subfolder_count = sf_count
        result.append(resp)
    return result


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(
    req: FolderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new folder."""
    folder = FolderService.create_folder(db, current_user.id, req)
    return FolderResponse.model_validate(folder)


@router.get("/{folder_id}", response_model=FolderResponse)
def get_folder_details(
    folder_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get folder details with file and subfolder counts."""
    folder = FolderService.get_folder_by_id(db, folder_id, current_user.id)
    f_count, sf_count = FolderService.get_folder_counts(db, folder.id, current_user.id)
    resp = FolderResponse.model_validate(folder)
    resp.file_count = f_count
    resp.subfolder_count = sf_count
    return resp


@router.get("/{folder_id}/breadcrumbs", response_model=list[BreadcrumbItem])
def get_breadcrumbs(
    folder_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get breadcrumb navigation trail for folder."""
    return FolderService.get_breadcrumbs(db, folder_id, current_user.id)


@router.patch("/{folder_id}", response_model=FolderResponse)
def rename_folder(
    folder_id: uuid.UUID,
    req: FolderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Rename a folder."""
    folder = FolderService.rename_folder(db, folder_id, current_user.id, req)
    return FolderResponse.model_validate(folder)


@router.post("/{folder_id}/move", response_model=FolderResponse)
def move_folder(
    folder_id: uuid.UUID,
    req: FolderMoveRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Move folder to a different parent directory."""
    folder = FolderService.move_folder(db, folder_id, current_user.id, req.parent_id)
    return FolderResponse.model_validate(folder)


@router.delete("/{folder_id}", response_model=MessageResponse)
def delete_folder(
    folder_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Move folder and all contents to trash."""
    FolderService.delete_folder(db, folder_id, current_user.id)
    return MessageResponse(message="Folder moved to trash.")
