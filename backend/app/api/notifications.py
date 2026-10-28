"""In-app notifications API endpoints."""

import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.notification import NotificationResponse, NotificationUpdate
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
def get_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Retrieve notifications for the user."""
    notifs = NotificationService.get_user_notifications(
        db,
        current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return [NotificationResponse.model_validate(n) for n in notifs]


@router.patch("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: uuid.UUID,
    req: NotificationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Mark a notification as read or unread."""
    notif = NotificationService.mark_as_read(db, notification_id, current_user.id)
    if not notif:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    return NotificationResponse.model_validate(notif)


@router.post("/read-all", response_model=MessageResponse)
def mark_all_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Mark all unread notifications as read."""
    count = NotificationService.mark_all_as_read(db, current_user.id)
    return MessageResponse(message=f"Marked {count} notifications as read.")
