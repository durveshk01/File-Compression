"""Tag management API endpoints."""

import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.tag import FileTagRequest, TagCreate, TagResponse
from app.services.tag_service import TagService

router = APIRouter(prefix="/api", tags=["Tags"])


@router.get("/tags", response_model=list[TagResponse])
def list_tags(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """List all custom tags created by user."""
    tags = TagService.get_user_tags(db, current_user.id)
    return [TagResponse.model_validate(t) for t in tags]


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(
    req: TagCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new tag."""
    tag = TagService.create_tag(db, current_user.id, req)
    return TagResponse.model_validate(tag)


@router.post("/files/{file_id}/tags", response_model=list[TagResponse])
def assign_file_tags(
    file_id: uuid.UUID,
    req: FileTagRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Associate tags with a specific file."""
    tags = TagService.set_file_tags(db, file_id, current_user.id, req)
    return [TagResponse.model_validate(t) for t in tags]
