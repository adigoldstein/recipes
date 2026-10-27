"""Pydantic request and response schemas for recipes."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer

from app.photos.schemas import PhotoRead
from app.recipes.units import SourceUnit, Unit
from app.tags.schemas import TagInput, TagRef

DESCRIPTION_MAX_LENGTH = 500
NOTES_MAX_LENGTH = 5000

# AD-31: an exact Decimal inside, a plain JSON number on the wire.
Amount = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class IngredientCreate(BaseModel):
    """An ingredient in a recipe write; its position is its place in the list."""

    name: str = Field(min_length=1)
    amount: Amount | None = Field(default=None, ge=0)
    unit: Unit | None = None
    note: str | None = None


class StepCreate(BaseModel):
    description: str = Field(min_length=1)


class RecipeCreate(BaseModel):
    """Everything needed to create a recipe; tags are ids or names (AD-25)."""

    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)
    base_servings: int = Field(ge=1)
    prep_time_minutes: int | None = Field(default=None, ge=0)
    cook_time_minutes: int | None = Field(default=None, ge=0)
    source_url: str | None = Field(default=None, max_length=2048)
    tags: list[TagInput] = Field(default_factory=list)
    ingredients: list[IngredientCreate] = Field(default_factory=list)
    steps: list[StepCreate] = Field(default_factory=list)


class OriginalValue(BaseModel):
    """The ingredient's amount and unit before its first edit (FR-7).

    Both fields null means it was originally "to taste".
    """

    amount: Amount | None
    unit: Unit | None


class SourceValue(BaseModel):
    """An imperial value an import converted to metric (FR-21)."""

    amount: Amount
    unit: SourceUnit


class IngredientRead(BaseModel):
    id: uuid.UUID
    name: str
    amount: Amount | None
    unit: Unit | None
    note: str | None
    original: OriginalValue | None
    source: SourceValue | None


class StepRead(BaseModel):
    id: uuid.UUID
    description: str
    source_text: str | None


class RecipeSummary(BaseModel):
    id: uuid.UUID
    title: str
    tags: list[TagRef]
    total_minutes: int | None
    photo: PhotoRead | None
    created_at: datetime


class RecipeRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = Field(max_length=DESCRIPTION_MAX_LENGTH)
    notes: str | None = Field(max_length=NOTES_MAX_LENGTH)
    tags: list[TagRef]
    base_servings: int
    prep_time_minutes: int | None
    cook_time_minutes: int | None
    source_url: str | None
    photo: PhotoRead | None
    ingredients: list[IngredientRead]
    steps: list[StepRead]
    created_at: datetime
    updated_at: datetime
