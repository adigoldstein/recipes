"""Pydantic request and response schemas for recipes."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    WithJsonSchema,
)

from app.core.db import AMOUNT_QUANTUM
from app.photos.schemas import PHOTO_KEY_PATTERN, PhotoRead
from app.recipes.units import SourceUnit, Unit
from app.tags.schemas import TagInput, TagRef

DESCRIPTION_MAX_LENGTH = 500
NOTES_MAX_LENGTH = 5000
TITLE_MAX_LENGTH = 120
MAX_SERVINGS = 100

# AD-31: an exact Decimal inside, a plain JSON number on the wire.
Amount = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(AMOUNT_QUANTUM)


# A written amount is a positive number that fits NUMERIC(12, 3), stored exact to 3
# decimals; null means "to taste" (AD-31). The client only ever sends a JSON number.
MAX_AMOUNT = 10**9
WriteAmount = Annotated[
    Decimal,
    Field(lt=MAX_AMOUNT, allow_inf_nan=False),
    AfterValidator(_quantize),
    Field(gt=0),
    WithJsonSchema(
        {"type": "number", "exclusiveMinimum": 0, "exclusiveMaximum": MAX_AMOUNT}
    ),
]


class IngredientCreate(BaseModel):
    """An ingredient in a recipe write; its position is its place in the list."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    amount: WriteAmount | None = None
    unit: Unit | None = None
    note: str | None = None


class IngredientUpdate(IngredientCreate):
    """An ingredient in a recipe replace: with an `id` it is an existing one (AD-20)."""

    id: uuid.UUID | None = None


class StepCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(min_length=1)


class _RecipeFields(BaseModel):
    """What a recipe write shares; tags are ids or names (AD-25)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)
    base_servings: int = Field(ge=1, le=MAX_SERVINGS)
    prep_time_minutes: int | None = Field(default=None, ge=0)
    cook_time_minutes: int | None = Field(default=None, ge=0)
    source_url: str | None = Field(default=None, max_length=2048)
    tags: list[TagInput] = Field(default_factory=list)
    # The key of a photo uploaded with `POST /api/photos` (AD-27). On a create, none
    # means no photo. On an update it has three states: left out keeps the photo,
    # `null` removes it and a key sets it, so a client that knows nothing of photos
    # cannot erase one.
    photo_key: str | None = Field(default=None, pattern=PHOTO_KEY_PATTERN)


class RecipeCreate(_RecipeFields):
    """Everything needed to create a recipe."""

    ingredients: list[IngredientCreate] = Field(min_length=1)
    steps: list[StepCreate] = Field(min_length=1)


class RecipeUpdate(_RecipeFields):
    """The whole recipe, replacing the saved one (AD-4); never carries originals."""

    ingredients: list[IngredientUpdate] = Field(min_length=1)
    steps: list[StepCreate] = Field(min_length=1)


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
