"""FileShare and ShareLink database models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FileShare(Base):
    """Represents a file shared directly with another user."""

    __tablename__ = "file_shares"
    __table_args__ = (
        UniqueConstraint("file_id", "shared_with", name="uq_file_shares_file_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
    )
    shared_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    shared_with: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    permission: Mapped[str] = mapped_column(
        String(20), default="viewer", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    file: Mapped["File"] = relationship(  # noqa: F821
        "File", back_populates="shares"
    )
    sharer: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[shared_by]
    )
    recipient: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[shared_with]
    )

    def __repr__(self) -> str:
        return f"<FileShare(id={self.id}, file_id={self.file_id}, shared_with={self.shared_with})>"


class ShareLink(Base):
    """Represents a shareable link for a file."""

    __tablename__ = "share_links"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    max_downloads: Mapped[int | None] = mapped_column(Integer, nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    permission: Mapped[str] = mapped_column(
        String(20), default="view", nullable=False
    )
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    file: Mapped["File"] = relationship(  # noqa: F821
        "File", back_populates="share_links"
    )
    creator: Mapped["User"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return f"<ShareLink(id={self.id}, file_id={self.file_id})>"
