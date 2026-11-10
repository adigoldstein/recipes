"""The request and response shapes (Pydantic) of tags."""

import unicodedata
import uuid
from typing import Self

from pydantic import BaseModel, field_validator, model_validator

TAG_NAME_MAX_LENGTH = 40


def normalize_tag_name(name: str) -> str:
    """Cleans up a tag name: Unicode NFC form, no spaces at the ends, and single
    spaces between words (AD-24)."""
    return " ".join(unicodedata.normalize("NFC", name).split())


def _checked_name(name: str) -> str:
    name = normalize_tag_name(name)
    if not 1 <= len(name) <= TAG_NAME_MAX_LENGTH:
        raise ValueError(f"tag name must be 1-{TAG_NAME_MAX_LENGTH} characters")
    return name


class TagRef(BaseModel):
    """A tag as it appears inside a recipe in API responses (AD-20)."""

    id: uuid.UUID
    name: str


class TagRead(BaseModel):
    id: uuid.UUID
    name: str
    pinned: bool
    recipe_count: int


class TagCreate(BaseModel):
    """The body of `POST /tags`. The name is cleaned up and its length is checked."""

    name: str

    @field_validator("name")
    @classmethod
    def _normalize(cls, value: str) -> str:
        return _checked_name(value)


class TagUpdate(BaseModel):
    """The body of `PATCH /tags/{id}`. Send only the fields that change."""

    name: str | None = None
    pinned: bool | None = None

    @field_validator("name")
    @classmethod
    def _normalize(cls, value: str | None) -> str | None:
        return None if value is None else _checked_name(value)


class TagInput(BaseModel):
    """A tag sent when saving a recipe: either the id of an existing tag, or a name.
    A name is matched to an existing tag, or a new tag is created."""

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
