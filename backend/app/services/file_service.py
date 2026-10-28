"""File management service handling upload, download, metadata, versions, and trash."""

import uuid
from datetime import datetime, timezone
from typing import Generator
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, desc, asc, or_, and_
from fastapi import HTTPException, status, UploadFile

from app.core.config import settings
from app.models.file import File, FileVersion
from app.models.folder import Folder
from app.models.user import User
from app.models.share import FileShare
from app.models.tag import Tag, FileTag
from app.schemas.file import (
    BulkActionRequest,
    FileCopyRequest,
    FileMoveRequest,
    FileResponse,
    FileUpdate,
    TagResponse,
)
from app.storage import get_storage_provider
from app.utils.file_utils import (
    determine_mime_type,
    generate_storage_key,
    get_file_category,
    sanitize_filename,
)
from app.utils.hashing import calculate_sha256
from app.services.activity_service import ActivityService


class FileService:
    @staticmethod
    def check_file_access(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> tuple[File, str]:
        """Verify user has access to file. Returns (File, permission: 'owner' | 'editor' | 'viewer')."""
        file = db.scalar(
            select(File)
            .options(joinedload(File.file_tags).joinedload(FileTag.tag))
            .where(File.id == file_id)
        )
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

        if file.owner_id == user_id:
            return file, "owner"

        # Check direct share
        share = db.scalar(
            select(FileShare).where(
                FileShare.file_id == file_id,
                FileShare.shared_with == user_id,
            )
        )
        if share:
            return file, share.permission

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this file.",
        )

    @staticmethod
    async def upload_file(
        db: Session,
        user: User,
        upload: UploadFile,
        folder_id: uuid.UUID | None = None,
    ) -> File:
        """Handle single or multiple file upload with quota verification."""
        content = await upload.read()
        size_bytes = len(content)

        if size_bytes == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot upload empty file.")

        if size_bytes > settings.max_file_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB.",
            )

        # Atomic check storage quota
        if user.storage_used_bytes + size_bytes > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Storage quota exceeded. Please free up space or upgrade.",
            )

        # Verify folder if given
        if folder_id:
            folder = db.scalar(
                select(Folder).where(
                    Folder.id == folder_id,
                    Folder.owner_id == user.id,
                    Folder.is_trashed.is_(False),
                )
            )
            if not folder:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target folder not found.")

        clean_filename = sanitize_filename(upload.filename or "uploaded_file")
        mime_type = determine_mime_type(clean_filename, upload.content_type)
        checksum = calculate_sha256(content)
        storage_key = generate_storage_key(user.id, clean_filename)

        # Write to storage provider
        storage = get_storage_provider()
        await storage.save_file(storage_key, content)

        # Create File record
        file_record = File(
            owner_id=user.id,
            folder_id=folder_id,
            original_filename=clean_filename,
            storage_key=storage_key,
            mime_type=mime_type,
            size_bytes=size_bytes,
            checksum=checksum,
            current_version=1,
        )
        db.add(file_record)
        db.flush()

        # Create Version 1 record
        version_record = FileVersion(
            file_id=file_record.id,
            version_number=1,
            storage_key=storage_key,
            size_bytes=size_bytes,
            checksum=checksum,
            uploaded_by=user.id,
        )
        db.add(version_record)

        # Update user's used storage
        user.storage_used_bytes += size_bytes
        db.commit()
        db.refresh(file_record)

        ActivityService.log_activity(
            db,
            user_id=user.id,
            action="file_uploaded",
            resource_type="file",
            resource_id=file_record.id,
            resource_name=file_record.original_filename,
            details={"size_bytes": size_bytes, "mime_type": mime_type},
        )

        return file_record

    @staticmethod
    def get_files(
        db: Session,
        user_id: uuid.UUID,
        folder_id: uuid.UUID | None = None,
        category: str | None = None,
        tag: str | None = None,
        starred_only: bool = False,
        trashed_only: bool = False,
        search_query: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[File], int]:
        """Fetch files matching filters, search criteria, sorting, and pagination."""
        query = (
            select(File)
            .options(joinedload(File.file_tags).joinedload(FileTag.tag))
            .where(File.owner_id == user_id)
        )

        # Trash filter
        if trashed_only:
            query = query.where(File.is_trashed.is_(True))
        else:
            query = query.where(File.is_trashed.is_(False))

        # Starred filter
        if starred_only:
            query = query.where(File.is_starred.is_(True))

        # Folder filter (only when not searching globally and not filtering by category or starred)
        if not search_query and not category and not starred_only and not trashed_only:
            query = query.where(File.folder_id == folder_id)

        # Search filter
        if search_query:
            pattern = f"%{search_query.strip()}%"
            query = query.where(
                or_(
                    File.original_filename.ilike(pattern),
                    File.mime_type.ilike(pattern),
                )
            )

        # Tag filter
        if tag:
            query = query.join(File.file_tags).join(FileTag.tag).where(Tag.name == tag)

        # Total count query before pagination
        count_stmt = select(func.count()).select_from(query.subquery())
        total = db.scalar(count_stmt) or 0

        # Sorting
        sort_col = getattr(File, sort_by, File.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        # Pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        files = list(db.scalars(query).unique().all())

        # In-memory category filter if requested
        if category and category.lower() != "all":
            filtered = [f for f in files if get_file_category(f.original_filename, f.mime_type) == category.lower()]
            return filtered, len(filtered)

        return files, total

    @staticmethod
    def rename_file(db: Session, file_id: uuid.UUID, user_id: uuid.UUID, new_name: str) -> File:
        file, perm = FileService.check_file_access(db, file_id, user_id)
        if perm == "viewer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot rename file.")

        clean_name = sanitize_filename(new_name)
        old_name = file.original_filename
        file.original_filename = clean_name
        file.mime_type = determine_mime_type(clean_name, file.mime_type)
        db.commit()
        db.refresh(file)

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="file_renamed",
            resource_type="file",
            resource_id=file.id,
            resource_name=clean_name,
            details={"old_name": old_name, "new_name": clean_name},
        )
        return file

    @staticmethod
    def move_file(db: Session, file_id: uuid.UUID, user_id: uuid.UUID, req: FileMoveRequest) -> File:
        file, perm = FileService.check_file_access(db, file_id, user_id)
        if perm == "viewer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot move file.")

        if req.folder_id:
            folder = db.scalar(
                select(Folder).where(
                    Folder.id == req.folder_id,
                    Folder.owner_id == file.owner_id,
                    Folder.is_trashed.is_(False),
                )
            )
            if not folder:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target folder not found.")

        file.folder_id = req.folder_id
        db.commit()
        db.refresh(file)

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="file_moved",
            resource_type="file",
            resource_id=file.id,
            resource_name=file.original_filename,
            details={"folder_id": str(req.folder_id) if req.folder_id else None},
        )
        return file

    @staticmethod
    async def copy_file(db: Session, file_id: uuid.UUID, user: User, req: FileCopyRequest) -> File:
        source_file, _ = FileService.check_file_access(db, file_id, user.id)

        if user.storage_used_bytes + source_file.size_bytes > user.storage_quota_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Storage quota exceeded for copy.")

        storage = get_storage_provider()
        content = await storage.get_file(source_file.storage_key)

        copy_filename = req.new_name or f"Copy of {source_file.original_filename}"
        new_storage_key = generate_storage_key(user.id, copy_filename)
        await storage.save_file(new_storage_key, content)

        new_file = File(
            owner_id=user.id,
            folder_id=req.folder_id or source_file.folder_id,
            original_filename=copy_filename,
            storage_key=new_storage_key,
            mime_type=source_file.mime_type,
            size_bytes=source_file.size_bytes,
            checksum=source_file.checksum,
            current_version=1,
        )
        db.add(new_file)
        db.flush()

        new_version = FileVersion(
            file_id=new_file.id,
            version_number=1,
            storage_key=new_storage_key,
            size_bytes=source_file.size_bytes,
            checksum=source_file.checksum,
            uploaded_by=user.id,
        )
        db.add(new_version)

        user.storage_used_bytes += source_file.size_bytes
        db.commit()
        db.refresh(new_file)

        ActivityService.log_activity(
            db,
            user_id=user.id,
            action="file_copied",
            resource_type="file",
            resource_id=new_file.id,
            resource_name=new_file.original_filename,
        )
        return new_file

    @staticmethod
    def toggle_star(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        file, _ = FileService.check_file_access(db, file_id, user_id)
        file.is_starred = not file.is_starred
        db.commit()
        db.refresh(file)
        return file.is_starred

    @staticmethod
    def soft_delete_file(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> None:
        file, perm = FileService.check_file_access(db, file_id, user_id)
        if perm != "owner":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can delete file.")

        file.is_trashed = True
        file.trashed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="file_deleted",
            resource_type="file",
            resource_id=file.id,
            resource_name=file.original_filename,
        )

    @staticmethod
    def restore_file(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> None:
        file = db.scalar(
            select(File).where(File.id == file_id, File.owner_id == user_id)
        )
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in trash.")

        file.is_trashed = False
        file.trashed_at = None
        db.commit()

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="file_restored",
            resource_type="file",
            resource_id=file.id,
            resource_name=file.original_filename,
        )

    @staticmethod
    async def permanent_delete_file(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> None:
        file = db.scalar(
            select(File)
            .options(joinedload(File.versions))
            .where(File.id == file_id, File.owner_id == user_id)
        )
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

        user = db.scalar(select(User).where(User.id == user_id))
        storage = get_storage_provider()

        total_reclaimed = 0
        # Delete storage objects for all versions
        for v in file.versions:
            total_reclaimed += v.size_bytes
            try:
                await storage.delete_file(v.storage_key)
            except Exception:
                pass

        # Also ensure current storage_key deleted if separate
        try:
            await storage.delete_file(file.storage_key)
        except Exception:
            pass

        # Adjust quota
        if user:
            user.storage_used_bytes = max(0, user.storage_used_bytes - total_reclaimed)

        filename = file.original_filename
        db.delete(file)
        db.commit()

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="file_permanently_deleted",
            resource_type="file",
            resource_id=file_id,
            resource_name=filename,
        )

    @staticmethod
    async def upload_new_version(
        db: Session,
        file_id: uuid.UUID,
        user: User,
        upload: UploadFile,
    ) -> FileVersion:
        file, perm = FileService.check_file_access(db, file_id, user.id)
        if perm == "viewer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot upload new versions.")

        content = await upload.read()
        size_bytes = len(content)

        if user.storage_used_bytes + size_bytes > user.storage_quota_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Storage quota exceeded for new version.")

        storage = get_storage_provider()
        storage_key = generate_storage_key(user.id, f"v{file.current_version + 1}_{file.original_filename}")
        await storage.save_file(storage_key, content)

        checksum = calculate_sha256(content)
        new_version_num = file.current_version + 1

        version = FileVersion(
            file_id=file.id,
            version_number=new_version_num,
            storage_key=storage_key,
            size_bytes=size_bytes,
            checksum=checksum,
            uploaded_by=user.id,
        )
        db.add(version)

        # Update active file metadata
        file.storage_key = storage_key
        file.size_bytes = size_bytes
        file.checksum = checksum
        file.current_version = new_version_num

        user.storage_used_bytes += size_bytes
        db.commit()
        db.refresh(version)

        ActivityService.log_activity(
            db,
            user_id=user.id,
            action="file_version_uploaded",
            resource_type="file",
            resource_id=file.id,
            resource_name=file.original_filename,
            details={"version": new_version_num, "size_bytes": size_bytes},
        )
        return version

    @staticmethod
    def get_file_versions(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> list[FileVersion]:
        FileService.check_file_access(db, file_id, user_id)
        query = (
            select(FileVersion)
            .where(FileVersion.file_id == file_id)
            .order_by(desc(FileVersion.version_number))
        )
        return list(db.scalars(query).all())

    @staticmethod
    async def restore_version(
        db: Session,
        file_id: uuid.UUID,
        version_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> File:
        file, perm = FileService.check_file_access(db, file_id, user_id)
        if perm == "viewer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot restore version.")

        target_version = db.scalar(
            select(FileVersion).where(
                FileVersion.id == version_id,
                FileVersion.file_id == file_id,
            )
        )
        if not target_version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target version not found.")

        # Set active file pointer to target version
        file.storage_key = target_version.storage_key
        file.size_bytes = target_version.size_bytes
        file.checksum = target_version.checksum
        file.current_version = target_version.version_number
        db.commit()
        db.refresh(file)

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="file_version_restored",
            resource_type="file",
            resource_id=file.id,
            resource_name=file.original_filename,
            details={"version": target_version.version_number},
        )
        return file

    @staticmethod
    async def execute_bulk_action(
        db: Session,
        user: User,
        req: BulkActionRequest,
    ) -> int:
        count = 0
        for fid in req.file_ids:
            try:
                if req.action == "delete":
                    FileService.soft_delete_file(db, fid, user.id)
                    count += 1
                elif req.action == "restore":
                    FileService.restore_file(db, fid, user.id)
                    count += 1
                elif req.action == "permanent_delete":
                    await FileService.permanent_delete_file(db, fid, user.id)
                    count += 1
                elif req.action == "star":
                    f, _ = FileService.check_file_access(db, fid, user.id)
                    f.is_starred = True
                    db.commit()
                    count += 1
                elif req.action == "unstar":
                    f, _ = FileService.check_file_access(db, fid, user.id)
                    f.is_starred = False
                    db.commit()
                    count += 1
                elif req.action == "move":
                    FileService.move_file(db, fid, user.id, FileMoveRequest(folder_id=req.folder_id))
                    count += 1
            except Exception:
                continue
        return count
