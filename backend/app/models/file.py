"""File and FileVersion database models."""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class File(Base):
    """Represents a stored file in CloudVault."""

    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True,
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(
        String(512), unique=True, nullable=False
    )
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_trashed: Mapped[bool] = mapped_column(Boolean, default=False)
    trashed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="files"
    )
    folder: Mapped["Folder | None"] = relationship(  # noqa: F821
        "Folder", back_populates="files"
    )
    versions: Mapped[list["FileVersion"]] = relationship(
        "FileVersion", back_populates="file", cascade="all, delete-orphan"
    )
    shares: Mapped[list["FileShare"]] = relationship(  # noqa: F821
        "FileShare", back_populates="file", cascade="all, delete-orphan"
    )
    share_links: Mapped[list["ShareLink"]] = relationship(  # noqa: F821
        "ShareLink", back_populates="file", cascade="all, delete-orphan"
    )
    file_tags: Mapped[list["FileTag"]] = relationship(  # noqa: F821
        "FileTag", back_populates="file", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<File(id={self.id}, filename={self.original_filename!r})>"


class FileVersion(Base):
    """Represents a specific version of a file."""

    __tablename__ = "file_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    file: Mapped["File"] = relationship("File", back_populates="versions")
    uploader: Mapped["User | None"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return f"<FileVersion(file_id={self.file_id}, v={self.version_number})>"
