"""Folder management service."""

import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from fastapi import HTTPException, status

from app.models.folder import Folder
from app.models.file import File
from app.schemas.folder import FolderCreate, FolderUpdate, BreadcrumbItem
from app.services.activity_service import ActivityService


class FolderService:
    @staticmethod
    def create_folder(db: Session, user_id: uuid.UUID, req: FolderCreate) -> Folder:
        clean_name = req.name.strip()
        if not clean_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder name cannot be empty.")

        # If parent_id provided, verify parent exists and belongs to user
        if req.parent_id:
            parent = db.scalar(
                select(Folder).where(
                    Folder.id == req.parent_id,
                    Folder.owner_id == user_id,
                    Folder.is_trashed.is_(False),
                )
            )
            if not parent:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found.")

        # Check duplicate name in same parent
        existing = db.scalar(
            select(Folder).where(
                Folder.owner_id == user_id,
                Folder.parent_id == req.parent_id,
                Folder.name == clean_name,
                Folder.is_trashed.is_(False),
            )
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A folder with this name already exists here.")

        folder = Folder(
            owner_id=user_id,
            parent_id=req.parent_id,
            name=clean_name,
        )
        db.add(folder)
        db.commit()
        db.refresh(folder)

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="folder_created",
            resource_type="folder",
            resource_id=folder.id,
            resource_name=folder.name,
        )
        return folder

    @staticmethod
    def get_user_folders(
        db: Session,
        user_id: uuid.UUID,
        parent_id: uuid.UUID | None = None,
        include_trashed: bool = False,
    ) -> list[Folder]:
        query = select(Folder).where(
            Folder.owner_id == user_id,
            Folder.parent_id == parent_id,
        )
        if not include_trashed:
            query = query.where(Folder.is_trashed.is_(False))
        query = query.order_by(Folder.name.asc())
        return list(db.scalars(query).all())

    @staticmethod
    def get_folder_by_id(db: Session, folder_id: uuid.UUID, user_id: uuid.UUID) -> Folder:
        folder = db.scalar(
            select(Folder).where(
                Folder.id == folder_id,
                Folder.owner_id == user_id,
            )
        )
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found.")
        return folder

    @staticmethod
    def get_breadcrumbs(db: Session, folder_id: uuid.UUID | None, user_id: uuid.UUID) -> list[BreadcrumbItem]:
        breadcrumbs = []
        current_id = folder_id
        # Prevent infinite loops with depth limit
        depth = 0
        while current_id and depth < 50:
            folder = db.scalar(
                select(Folder).where(Folder.id == current_id, Folder.owner_id == user_id)
            )
            if not folder:
                break
            breadcrumbs.insert(0, BreadcrumbItem(id=folder.id, name=folder.name))
            current_id = folder.parent_id
            depth += 1
        return breadcrumbs

    @staticmethod
    def rename_folder(db: Session, folder_id: uuid.UUID, user_id: uuid.UUID, req: FolderUpdate) -> Folder:
        folder = FolderService.get_folder_by_id(db, folder_id, user_id)
        clean_name = req.name.strip()
        if not clean_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder name cannot be empty.")

        # Check duplicate name
        existing = db.scalar(
            select(Folder).where(
                Folder.owner_id == user_id,
                Folder.parent_id == folder.parent_id,
                Folder.name == clean_name,
                Folder.id != folder_id,
                Folder.is_trashed.is_(False),
            )
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A folder with this name already exists in this directory.")

        old_name = folder.name
        folder.name = clean_name
        db.commit()
        db.refresh(folder)

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="folder_renamed",
            resource_type="folder",
            resource_id=folder.id,
            resource_name=clean_name,
            details={"old_name": old_name, "new_name": clean_name},
        )
        return folder

    @staticmethod
    def move_folder(db: Session, folder_id: uuid.UUID, user_id: uuid.UUID, target_parent_id: uuid.UUID | None) -> Folder:
        folder = FolderService.get_folder_by_id(db, folder_id, user_id)

        if folder.id == target_parent_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot move folder into itself.")

        if target_parent_id:
            target_parent = FolderService.get_folder_by_id(db, target_parent_id, user_id)
            # Check if target_parent is a descendant of folder
            curr = target_parent
            depth = 0
            while curr and depth < 50:
                if curr.id == folder.id:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot move folder into one of its descendants.")
                if curr.parent_id:
                    curr = db.scalar(select(Folder).where(Folder.id == curr.parent_id, Folder.owner_id == user_id))
                else:
                    curr = None
                depth += 1

        folder.parent_id = target_parent_id
        db.commit()
        db.refresh(folder)

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="folder_moved",
            resource_type="folder",
            resource_id=folder.id,
            resource_name=folder.name,
            details={"target_parent_id": str(target_parent_id) if target_parent_id else None},
        )
        return folder

    @staticmethod
    def delete_folder(db: Session, folder_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Move folder and all its contents to trash."""
        folder = FolderService.get_folder_by_id(db, folder_id, user_id)
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Collect all descendant folder IDs
        folder_ids = [folder.id]
        idx = 0
        while idx < len(folder_ids):
            current_id = folder_ids[idx]
            children = db.scalars(
                select(Folder.id).where(Folder.parent_id == current_id, Folder.owner_id == user_id)
            ).all()
            folder_ids.extend(children)
            idx += 1

        # Soft delete folders
        for fid in folder_ids:
            f = db.scalar(select(Folder).where(Folder.id == fid))
            if f:
                f.is_trashed = True
                f.trashed_at = now

            # Soft delete files inside
            files = db.scalars(select(File).where(File.folder_id == fid, File.owner_id == user_id)).all()
            for file in files:
                if not file.is_trashed:
                    file.is_trashed = True
                    file.trashed_at = now

        db.commit()

        ActivityService.log_activity(
            db,
            user_id=user_id,
            action="folder_deleted",
            resource_type="folder",
            resource_id=folder.id,
            resource_name=folder.name,
        )

    @staticmethod
    def get_folder_counts(db: Session, folder_id: uuid.UUID, user_id: uuid.UUID) -> tuple[int, int]:
        file_count = db.scalar(
            select(func.count(File.id)).where(
                File.folder_id == folder_id,
                File.owner_id == user_id,
                File.is_trashed.is_(False),
            )
        ) or 0
        subfolder_count = db.scalar(
            select(func.count(Folder.id)).where(
                Folder.parent_id == folder_id,
                Folder.owner_id == user_id,
                Folder.is_trashed.is_(False),
            )
        ) or 0
        return file_count, subfolder_count
