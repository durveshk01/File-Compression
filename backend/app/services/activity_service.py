"""Activity logging service."""

import uuid
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from app.models.activity import ActivityLog


class ActivityService:
    @staticmethod
    def log_activity(
        db: Session,
        user_id: uuid.UUID,
        action: str,
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
        resource_name: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> ActivityLog:
        """Record an activity event for a user."""
        log = ActivityLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            details=details,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def get_user_activities(
        db: Session,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ActivityLog]:
        """Fetch recent activity logs for a user."""
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.user_id == user_id)
            .order_by(desc(ActivityLog.created_at))
            .offset(offset)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())
