"""Activity logs API endpoints."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.activity import ActivityResponse
from app.services.activity_service import ActivityService

router = APIRouter(prefix="/api/activity", tags=["Activity"])


@router.get("", response_model=list[ActivityResponse])
def get_user_activity(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Retrieve audit and activity logs for current user."""
    logs = ActivityService.get_user_activities(db, current_user.id, limit=limit, offset=offset)
    return [ActivityResponse.model_validate(l) for l in logs]
