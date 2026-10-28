"""File sharing and ShareLink service."""

import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_, or_, desc
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.file import File
from app.models.user import User
from app.models.share import FileShare, ShareLink
from app.schemas.share import FileShareCreate, ShareLinkCreate
from app.utils.hashing import generate_secure_token, hash_token
from app.services.activity_service import ActivityService
from app.services.notification_service import NotificationService


class ShareService:
    @staticmethod
    def share_file_with_user(
        db: Session,
        file_id: uuid.UUID,
        owner: User,
        req: FileShareCreate,
    ) -> FileShare:
        file = db.scalar(select(File).where(File.id == file_id, File.owner_id == owner.id))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

        target_user = db.scalar(select(User).where(User.email == req.shared_with_email.lower()))
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No registered user found with that email.")

        if target_user.id == owner.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot share a file with yourself.")

        # Check existing share
        existing = db.scalar(
            select(FileShare).where(
                FileShare.file_id == file_id,
                FileShare.shared_with == target_user.id,
            )
        )
        if existing:
            existing.permission = req.permission
            db.commit()
            db.refresh(existing)
            return existing

        share = FileShare(
            file_id=file_id,
            shared_by=owner.id,
            shared_with=target_user.id,
            permission=req.permission,
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        # Notify recipient
        NotificationService.create_notification(
            db,
            user_id=target_user.id,
            type_="file_shared",
            title="New File Shared",
            message=f"{owner.full_name} shared '{file.original_filename}' with you.",
            resource_type="file",
            resource_id=file.id,
        )

        ActivityService.log_activity(
            db,
            user_id=owner.id,
            action="file_shared",
            resource_type="file",
            resource_id=file.id,
            resource_name=file.original_filename,
            details={"shared_with": target_user.email, "permission": req.permission},
        )
        return share

    @staticmethod
    def get_file_shares(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> list[FileShare]:
        file = db.scalar(select(File).where(File.id == file_id, File.owner_id == user_id))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found or not owner.")

        query = (
            select(FileShare)
            .options(joinedload(FileShare.recipient), joinedload(FileShare.sharer))
            .where(FileShare.file_id == file_id)
        )
        return list(db.scalars(query).all())

    @staticmethod
    def revoke_share(db: Session, share_id: uuid.UUID, user_id: uuid.UUID) -> None:
        share = db.scalar(
            select(FileShare)
            .options(joinedload(FileShare.file))
            .where(FileShare.id == share_id)
        )
        if not share or (share.shared_by != user_id and share.file.owner_id != user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share record not found.")

        file_name = share.file.original_filename
        recipient_id = share.shared_with
        db.delete(share)
        db.commit()

        # Notify former recipient
        NotificationService.create_notification(
            db,
            user_id=recipient_id,
            type_="share_revoked",
            title="Share Access Revoked",
            message=f"Access to '{file_name}' was revoked.",
            resource_type="file",
        )

    @staticmethod
    def get_shared_with_me(db: Session, user_id: uuid.UUID) -> list[FileShare]:
        query = (
            select(FileShare)
            .options(
                joinedload(FileShare.file).joinedload(File.owner),
                joinedload(FileShare.sharer),
            )
            .join(File, FileShare.file_id == File.id)
            .where(
                FileShare.shared_with == user_id,
                File.is_trashed.is_(False),
            )
            .order_by(desc(FileShare.created_at))
        )
        return list(db.scalars(query).all())

    @staticmethod
    def get_shared_by_me(db: Session, user_id: uuid.UUID) -> list[FileShare]:
        query = (
            select(FileShare)
            .options(
                joinedload(FileShare.file),
                joinedload(FileShare.recipient),
            )
            .where(FileShare.shared_by == user_id)
            .order_by(desc(FileShare.created_at))
        )
        return list(db.scalars(query).all())

    # --- Share Links ---

    @staticmethod
    def create_share_link(
        db: Session,
        file_id: uuid.UUID,
        owner: User,
        req: ShareLinkCreate,
    ) -> tuple[ShareLink, str]:
        file = db.scalar(select(File).where(File.id == file_id, File.owner_id == owner.id))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

        raw_token = generate_secure_token(32)
        token_hashed = hash_token(raw_token)

        pwd_hash = hash_password(req.password) if req.password else None

        link = ShareLink(
            file_id=file_id,
            token_hash=token_hashed,
            password_hash=pwd_hash,
            expires_at=req.expires_at,
            max_downloads=req.max_downloads,
            permission=req.permission,
            created_by=owner.id,
        )
        db.add(link)
        db.commit()
        db.refresh(link)

        ActivityService.log_activity(
            db,
            user_id=owner.id,
            action="share_link_created",
            resource_type="file",
            resource_id=file.id,
            resource_name=file.original_filename,
            details={"expires_at": str(req.expires_at) if req.expires_at else None},
        )
        return link, raw_token

    @staticmethod
    def get_share_links_for_file(db: Session, file_id: uuid.UUID, user_id: uuid.UUID) -> list[ShareLink]:
        file = db.scalar(select(File).where(File.id == file_id, File.owner_id == user_id))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

        query = (
            select(ShareLink)
            .where(ShareLink.file_id == file_id, ShareLink.is_revoked.is_(False))
            .order_by(desc(ShareLink.created_at))
        )
        return list(db.scalars(query).all())

    @staticmethod
    def revoke_share_link(db: Session, link_id: uuid.UUID, user_id: uuid.UUID) -> None:
        link = db.scalar(select(ShareLink).where(ShareLink.id == link_id, ShareLink.created_by == user_id))
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found.")
        link.is_revoked = True
        db.commit()

    @staticmethod
    def verify_public_link(
        db: Session,
        raw_token: str,
        password: str | None = None,
        require_password_check: bool = True,
    ) -> tuple[ShareLink, File]:
        hashed = hash_token(raw_token)
        link = db.scalar(
            select(ShareLink)
            .options(joinedload(ShareLink.file))
            .where(ShareLink.token_hash == hashed)
        )
        if not link or link.is_revoked:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link is invalid or revoked.")

        # Check expiration
        if link.expires_at and datetime.now(timezone.utc).replace(tzinfo=None) > link.expires_at.replace(tzinfo=None):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="This share link has expired.")

        # Check download limit
        if link.max_downloads and link.download_count >= link.max_downloads:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download limit for this link has been reached.")

        # Check password if configured and check is required
        if require_password_check and link.password_hash:
            if not password or not verify_password(password, link.password_hash):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password for this link.")

        if not link.file or link.file.is_trashed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The shared file is no longer available.")

        return link, link.file

    @staticmethod
    def increment_download_count(db: Session, link_id: uuid.UUID) -> None:
        link = db.scalar(select(ShareLink).where(ShareLink.id == link_id))
        if link:
            link.download_count += 1
            db.commit()
