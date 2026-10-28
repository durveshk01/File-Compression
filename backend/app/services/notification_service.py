"""Notification service."""

import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, update

from app.models.notification import Notification


class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        user_id: uuid.UUID,
        type_: str,
        title: str,
        message: str | None = None,
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=type_,
            title=title,
            message=message,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: uuid.UUID,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read.is_(False))
        query = query.order_by(desc(Notification.created_at)).offset(offset).limit(limit)
        return list(db.scalars(query).all())

    @staticmethod
    def mark_as_read(db: Session, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification | None:
        notification = db.scalar(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        if not notification:
            return None
        notification.is_read = True
        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def mark_all_as_read(db: Session, user_id: uuid.UUID) -> int:
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount
