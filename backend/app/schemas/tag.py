"""Tag schemas."""

import uuid
from pydantic import BaseModel, ConfigDict, Field


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TagResponse(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class FileTagRequest(BaseModel):
    tag_ids: list[uuid.UUID]
