"""Pydantic request and response schemas for tags."""

import uuid

from pydantic import BaseModel


class TagRef(BaseModel):
    """A tag as embedded in recipe read schemas (AD-20)."""

    id: uuid.UUID
    name: str
