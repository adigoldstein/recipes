"""Pydantic request and response schemas for tags."""

import unicodedata
import uuid
from typing import Self

from pydantic import BaseModel, model_validator

TAG_NAME_MAX_LENGTH = 40


def normalize_tag_name(name: str) -> str:
    """NFC, trimmed, inner whitespace collapsed to single spaces (AD-24)."""
    return " ".join(unicodedata.normalize("NFC", name).split())


class TagRef(BaseModel):
    """A tag as embedded in recipe read schemas (AD-20)."""

    id: uuid.UUID
    name: str


class TagRead(BaseModel):
    id: uuid.UUID
    name: str
    pinned: bool


class TagInput(BaseModel):
    """A tag in a recipe write: an existing tag by id, or a name to find or create."""

    id: uuid.UUID | None = None
    name: str | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> Self:
        if (self.id is None) == (self.name is None):
            raise ValueError("a tag needs exactly one of id or name")
        if self.name is not None:
            self.name = normalize_tag_name(self.name)
            if not 1 <= len(self.name) <= TAG_NAME_MAX_LENGTH:
                raise ValueError(f"tag name must be 1-{TAG_NAME_MAX_LENGTH} characters")
        return self
