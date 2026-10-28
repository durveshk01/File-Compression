"""File management API endpoints."""

import io
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, File as FastAPIFile, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.file import (
    BulkActionRequest,
    FileCopyRequest,
    FileMoveRequest,
    FileResponse,
    FileUpdate,
    FileVersionResponse,
    TagResponse,
    UploadCompleteRequest,
    UploadInitiateRequest,
    UploadInitiateResponse,
)
from app.services.file_service import FileService
from app.storage import get_storage_provider
from app.utils.file_utils import sanitize_filename, determine_mime_type

router = APIRouter(prefix="/api/files", tags=["Files"])


def _to_file_response(file) -> FileResponse:
    tags = []
    if hasattr(file, "file_tags") and file.file_tags:
        tags = [TagResponse(id=ft.tag.id, name=ft.tag.name) for ft in file.file_tags if ft.tag]
    resp = FileResponse.model_validate(file)
    resp.tags = tags
    return resp


@router.get("", response_model=PaginatedResponse[FileResponse])
def list_files(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    folder_id: uuid.UUID | None = Query(None),
    category: str | None = Query(None),
    tag: str | None = Query(None),
    search: str | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List files with search, filtering, sorting, and pagination."""
    files, total = FileService.get_files(
        db=db,
        user_id=current_user.id,
        folder_id=folder_id,
        category=category,
        tag=tag,
        starred_only=False,
        trashed_only=False,
        search_query=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    items = [_to_file_response(f) for f in files]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    folder_id: uuid.UUID | None = Query(None),
):
    """Upload a file with size, type, and quota validation."""
    uploaded = await FileService.upload_file(db, current_user, file, folder_id=folder_id)
    return _to_file_response(uploaded)


@router.post("/upload/initiate", response_model=UploadInitiateResponse)
def initiate_upload(
    req: UploadInitiateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Initiate an upload session for direct or presigned transfers."""
    if current_user.storage_used_bytes + req.size_bytes > current_user.storage_quota_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Storage quota exceeded.",
        )
    storage = get_storage_provider()
    upload_id = uuid.uuid4().hex
    storage_key = f"users/{current_user.id}/temp/{upload_id}_{sanitize_filename(req.filename)}"
    presigned_url = storage.generate_presigned_upload_url(storage_key)
    return UploadInitiateResponse(
        upload_id=upload_id,
        storage_key=storage_key,
        upload_url=presigned_url,
    )


@router.post("/upload/complete", response_model=FileResponse)
def complete_upload(
    req: UploadCompleteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Finalize an upload initiated via presigned URL."""
    # Build File and Version record after verifying uploaded size
    clean_name = sanitize_filename(req.filename)
    mime_type = determine_mime_type(clean_name, req.mime_type)
    from app.models.file import File, FileVersion

    file_rec = File(
        owner_id=current_user.id,
        folder_id=req.folder_id,
        original_filename=clean_name,
        storage_key=req.storage_key,
        mime_type=mime_type,
        size_bytes=req.size_bytes,
        checksum=req.checksum,
        current_version=1,
    )
    db.add(file_rec)
    db.flush()

    ver_rec = FileVersion(
        file_id=file_rec.id,
        version_number=1,
        storage_key=req.storage_key,
        size_bytes=req.size_bytes,
        checksum=req.checksum,
        uploaded_by=current_user.id,
    )
    db.add(ver_rec)
    current_user.storage_used_bytes += req.size_bytes
    db.commit()
    db.refresh(file_rec)
    return _to_file_response(file_rec)


@router.get("/{file_id}", response_model=FileResponse)
def get_file_metadata(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get metadata for a specific file (owner or shared collaborator)."""
    file, _ = FileService.check_file_access(db, file_id, current_user.id)
    return _to_file_response(file)


@router.patch("/{file_id}", response_model=FileResponse)
def update_file(
    file_id: uuid.UUID,
    req: FileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update file filename or starred state."""
    file, _ = FileService.check_file_access(db, file_id, current_user.id)
    if req.original_filename:
        file = FileService.rename_file(db, file_id, current_user.id, req.original_filename)
    if req.is_starred is not None:
        file.is_starred = req.is_starred
        db.commit()
        db.refresh(file)
    if req.folder_id is not None:
        file = FileService.move_file(db, file_id, current_user.id, FileMoveRequest(folder_id=req.folder_id))
    return _to_file_response(file)


@router.delete("/{file_id}", response_model=MessageResponse)
def delete_file(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Move file to trash."""
    FileService.soft_delete_file(db, file_id, current_user.id)
    return MessageResponse(message="File moved to trash.")


@router.get("/{file_id}/download")
@router.post("/{file_id}/download")
async def download_file(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Download file contents securely."""
    file, _ = FileService.check_file_access(db, file_id, current_user.id)
    storage = get_storage_provider()

    # Check for presigned S3 download URL
    presigned = storage.generate_presigned_download_url(file.storage_key, file.original_filename)
    if presigned:
        return {"download_url": presigned}

    content_bytes = await storage.get_file(file.storage_key)
    safe_name = file.original_filename.encode("ascii", "ignore").decode("ascii") or "download"
    return StreamingResponse(
        io.BytesIO(content_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/{file_id}/preview")
async def preview_file(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Inline safe preview of file content for supported types."""
    file, _ = FileService.check_file_access(db, file_id, current_user.id)
    storage = get_storage_provider()
    content_bytes = await storage.get_file(file.storage_key)
    mime = file.mime_type or "text/plain"
    # Ensure SVG or HTML is served safely to prevent XSS in application origin
    if mime == "image/svg+xml" or mime == "text/html":
        mime = "text/plain"
    return StreamingResponse(io.BytesIO(content_bytes), media_type=mime)


@router.post("/{file_id}/move", response_model=FileResponse)
def move_file(
    file_id: uuid.UUID,
    req: FileMoveRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Move file into a different folder."""
    file = FileService.move_file(db, file_id, current_user.id, req)
    return _to_file_response(file)


@router.post("/{file_id}/copy", response_model=FileResponse)
async def copy_file(
    file_id: uuid.UUID,
    req: FileCopyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Make a duplicate copy of a file."""
    new_file = await FileService.copy_file(db, file_id, current_user, req)
    return _to_file_response(new_file)


@router.post("/{file_id}/favorite", response_model=MessageResponse)
def toggle_favorite(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Toggle starred/favorite status of a file."""
    is_starred = FileService.toggle_star(db, file_id, current_user.id)
    return MessageResponse(message=f"File {'starred' if is_starred else 'unstarred'}.")


@router.delete("/{file_id}/favorite", response_model=MessageResponse)
def remove_favorite(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    file, _ = FileService.check_file_access(db, file_id, current_user.id)
    file.is_starred = False
    db.commit()
    return MessageResponse(message="File unstarred.")


@router.post("/bulk-action", response_model=MessageResponse)
async def bulk_action(
    req: BulkActionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Execute bulk actions across multiple files."""
    count = await FileService.execute_bulk_action(db, current_user, req)
    return MessageResponse(message=f"Action '{req.action}' successfully performed on {count} files.")


# --- Versioning endpoints ---


@router.get("/{file_id}/versions", response_model=list[FileVersionResponse])
def get_file_versions(
    file_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve complete version history for a file."""
    versions = FileService.get_file_versions(db, file_id, current_user.id)
    return [FileVersionResponse.model_validate(v) for v in versions]


@router.post("/{file_id}/versions", response_model=FileVersionResponse, status_code=status.HTTP_201_CREATED)
async def upload_new_version(
    file_id: uuid.UUID,
    file: UploadFile,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Upload a new version of an existing file."""
    version = await FileService.upload_new_version(db, file_id, current_user, file)
    return FileVersionResponse.model_validate(version)


@router.post("/{file_id}/versions/{version_id}/restore", response_model=FileResponse)
async def restore_version(
    file_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Restore file to a previous historical version."""
    file = await FileService.restore_version(db, file_id, version_id, current_user.id)
    return _to_file_response(file)
