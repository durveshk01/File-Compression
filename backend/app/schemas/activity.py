"""ActivityLog schemas."""

import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class ActivityResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    resource_type: str | None = None
    resource_id: uuid.UUID | None = None
    resource_name: str | None = None
    details: dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
