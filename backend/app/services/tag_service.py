"""Tag management service."""

import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.tag import Tag, FileTag
from app.models.file import File
from app.schemas.tag import TagCreate, FileTagRequest


class TagService:
    @staticmethod
    def create_tag(db: Session, user_id: uuid.UUID, req: TagCreate) -> Tag:
        clean_name = req.name.strip().lower()
        existing = db.scalar(
            select(Tag).where(Tag.user_id == user_id, Tag.name == clean_name)
        )
        if existing:
            return existing

        tag = Tag(name=clean_name, user_id=user_id)
        db.add(tag)
        db.commit()
        db.refresh(tag)
        return tag

    @staticmethod
    def get_user_tags(db: Session, user_id: uuid.UUID) -> list[Tag]:
        return list(db.scalars(select(Tag).where(Tag.user_id == user_id).order_by(Tag.name.asc())).all())

    @staticmethod
    def set_file_tags(
        db: Session,
        file_id: uuid.UUID,
        user_id: uuid.UUID,
        req: FileTagRequest,
    ) -> list[Tag]:
        file = db.scalar(select(File).where(File.id == file_id, File.owner_id == user_id))
        if not file:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

        # Clear existing file tags
        existing_file_tags = db.scalars(select(FileTag).where(FileTag.file_id == file_id)).all()
        for ft in existing_file_tags:
            db.delete(ft)

        # Add new tags
        tags = []
        for tid in req.tag_ids:
            tag = db.scalar(select(Tag).where(Tag.id == tid, Tag.user_id == user_id))
            if tag:
                ft = FileTag(file_id=file_id, tag_id=tag.id)
                db.add(ft)
                tags.append(tag)

        db.commit()
        return tags
