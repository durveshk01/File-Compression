"""Tag and FileTag database models."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Tag(Base):
    """Represents a user-defined tag for organizing files."""

    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("name", "user_id", name="uq_tags_name_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="tags"
    )
    file_tags: Mapped[list["FileTag"]] = relationship(
        "FileTag", back_populates="tag", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name={self.name!r})>"


class FileTag(Base):
    """Association between a file and a tag."""

    __tablename__ = "file_tags"
    __table_args__ = (
        UniqueConstraint("file_id", "tag_id", name="uq_file_tags_file_tag"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    file: Mapped["File"] = relationship(  # noqa: F821
        "File", back_populates="file_tags"
    )
    tag: Mapped["Tag"] = relationship("Tag", back_populates="file_tags")

    def __repr__(self) -> str:
        return f"<FileTag(file_id={self.file_id}, tag_id={self.tag_id})>"
