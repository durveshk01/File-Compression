"""Sharing and Public Link API endpoints."""

import io
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.share import (
    FileShareCreate,
    FileShareResponse,
    ShareLinkCreate,
    ShareLinkPublicResponse,
    ShareLinkResponse,
    ShareLinkVerifyRequest,
)
from app.services.share_service import ShareService
from app.storage import get_storage_provider
from app.utils.file_utils import is_previewable

router = APIRouter(prefix="/api", tags=["Sharing"])


@router.post("/files/{file_id}/shares", response_model=FileShareResponse, status_code=status.HTTP_201_CREATED)
def share_file_with_user(
    file_id: uuid.UUID,
    req: FileShareCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Share a file directly with another registered user by email."""
    share = ShareService.share_file_with_user(db, file_id, current_user, req)
    return FileShareResponse.model_validate(share)


@router.get("/files/{file_id}/shares", response_model=list[FileShareResponse])
def get_file_shares(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """List all registered users who have access to this file."""
    shares = ShareService.get_file_shares(db, file_id, current_user.id)
    return [FileShareResponse.model_validate(s) for s in shares]


@router.delete("/shares/{share_id}", response_model=MessageResponse)
def revoke_share(
    share_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Revoke sharing permissions for a user."""
    ShareService.revoke_share(db, share_id, current_user.id)
    return MessageResponse(message="Share access revoked.")


@router.get("/shared-with-me", response_model=list[FileShareResponse])
def get_shared_with_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """List files shared with the current user."""
    shares = ShareService.get_shared_with_me(db, current_user.id)
    return [FileShareResponse.model_validate(s) for s in shares]


@router.get("/shared-by-me", response_model=list[FileShareResponse])
def get_shared_by_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """List files the current user has shared with others."""
    shares = ShareService.get_shared_by_me(db, current_user.id)
    return [FileShareResponse.model_validate(s) for s in shares]


# --- Share Links ---


@router.post("/files/{file_id}/share-links", response_model=ShareLinkResponse, status_code=status.HTTP_201_CREATED)
def create_share_link(
    file_id: uuid.UUID,
    req: ShareLinkCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a shareable link with optional expiration, password, and download limit."""
    link, token = ShareService.create_share_link(db, file_id, current_user, req)
    resp = ShareLinkResponse.model_validate(link)
    resp.token = token
    resp.share_url = f"{settings.FRONTEND_URL}/shared/{token}"
    return resp


@router.get("/files/{file_id}/share-links", response_model=list[ShareLinkResponse])
def get_share_links_for_file(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """List all active share links for a file."""
    links = ShareService.get_share_links_for_file(db, file_id, current_user.id)
    return [ShareLinkResponse.model_validate(l) for l in links]


@router.delete("/share-links/{link_id}", response_model=MessageResponse)
def revoke_share_link(
    link_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Revoke/disable a share link."""
    ShareService.revoke_share_link(db, link_id, current_user.id)
    return MessageResponse(message="Share link revoked.")


# --- Public Share Endpoints ---


@router.get("/public/shares/{token}", response_model=ShareLinkPublicResponse)
def get_public_share_info(
    token: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Get public metadata for a shared link without leaking private owner information."""
    link, file = ShareService.verify_public_link(db, token, require_password_check=False)
    rem = None
    if link.max_downloads:
        rem = max(0, link.max_downloads - link.download_count)
    return ShareLinkPublicResponse(
        token=token,
        filename=file.original_filename,
        file_size=file.size_bytes,
        mime_type=file.mime_type,
        permission=link.permission,
        requires_password=bool(link.password_hash),
        is_expired=False,
        downloads_remaining=rem,
        preview_supported=is_previewable(file.original_filename, file.mime_type),
    )


@router.post("/public/shares/{token}/verify", response_model=MessageResponse)
def verify_public_link_password(
    token: str,
    req: ShareLinkVerifyRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Verify password for a password-protected share link."""
    ShareService.verify_public_link(db, token, password=req.password)
    return MessageResponse(message="Password verified.")


@router.get("/public/shares/{token}/download")
@router.post("/public/shares/{token}/download")
async def download_public_shared_file(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    password: str | None = Query(None),
):
    """Download a file via public share link with rate and quota limits checked."""
    link, file = ShareService.verify_public_link(db, token, password=password)
    if link.permission == "view":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This link is view-only. Direct download is not permitted.",
        )

    # Increment download counter
    ShareService.increment_download_count(db, link.id)

    storage = get_storage_provider()
    content = await storage.get_file(file.storage_key)
    safe_name = file.original_filename.encode("ascii", "ignore").decode("ascii") or "shared_file"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/public/shares/{token}/preview")
async def preview_public_shared_file(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    password: str | None = Query(None),
):
    """Safe inline preview of public shared file."""
    link, file = ShareService.verify_public_link(db, token, password=password)
    storage = get_storage_provider()
    content = await storage.get_file(file.storage_key)
    mime = file.mime_type or "text/plain"
    if mime == "image/svg+xml" or mime == "text/html":
        mime = "text/plain"
    return StreamingResponse(io.BytesIO(content), media_type=mime)
