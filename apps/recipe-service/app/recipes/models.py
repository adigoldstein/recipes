"""The database tables of the recipes module, and the items saved inside a recipe
(AD-41)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, PlainSerializer
from pydantic import Field as PydanticField
from sqlalchemy import Column, Text, text
from sqlmodel import Field, SQLModel

from app.core.db import AMOUNT_QUANTUM, PydanticJson, UtcDateTime, utcnow
from app.core.units import SourceUnit, Unit


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(AMOUNT_QUANTUM)


# An ingredient amount. In Python it is an exact `Decimal`. In the JSON column it is
# saved as a string with 3 decimals (`"250.000"`), because a JSON number would become
# an inexact float (AD-31, AD-41).
StoredAmount = Annotated[
    Decimal,
    AfterValidator(_quantize),
    PlainSerializer(lambda value: format(value, "f"), return_type=str),
]


class _Item(BaseModel):
    """The base class of the items saved inside a recipe.

    The items cannot be changed (frozen) on purpose. SQLAlchemy does not notice a
    change inside an item, so to change one, create a new item (`model_copy`) and
    assign a new list. Items are validated again when saved, so bad data never
    reaches the database.
    """

    model_config = ConfigDict(
        frozen=True, extra="forbid", revalidate_instances="always"
    )


class OriginalItem(_Item):
    """The amount and unit before the first edit (FR-7). If both are null, the
    original was "to taste"."""

    amount: StoredAmount | None
    unit: Unit | None


class SourceItem(_Item):
    """The imperial value that an import converted to metric (FR-21). This is not
    the same as the "original" value."""

    amount: StoredAmount
    unit: SourceUnit


class IngredientItem(_Item):
    id: uuid.UUID = PydanticField(default_factory=uuid.uuid4)
    name: str
    note: str | None = None
    amount: StoredAmount | None = None
    unit: Unit | None = None
    # `None` means the ingredient was never edited.
    # `OriginalItem(amount=None, unit=None)` means it was "to taste" before the edit.
    original: OriginalItem | None = None
    source: SourceItem | None = None


class StepItem(_Item):
    id: uuid.UUID = PydanticField(default_factory=uuid.uuid4)
    description: str
    # The step text before conversion. Set only when an import converted a
    # temperature.
    source_text: str | None = None


class Recipe(SQLModel, table=True):
    __tablename__ = "recipe"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=120)
    description: str | None = Field(default=None, sa_type=Text)
    notes: str | None = Field(default=None, sa_type=Text)
    base_servings: int
    prep_time_minutes: int | None = None
    cook_time_minutes: int | None = None
    source_url: str | None = Field(default=None, max_length=2048)
    # The key of the recipe's photo (AD-27). Only saving a recipe sets it. The files
    # themselves are managed by `photos.service`.
    photo_key: str | None = Field(default=None, max_length=32)
    # The site an imported photo came from, shown as the photo credit.
    photo_credit_domain: str | None = Field(default=None, max_length=255)
    # The foreign key is a string because recipes may not import the users module.
    # When a user is deleted, their recipes stay, without an author.
    created_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    updated_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)
    updated_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)

    # The list order is the display order (AD-41). To change it, assign a new list.
    ingredients: list[IngredientItem] = Field(
        default_factory=list,
        sa_column=Column(
            PydanticJson(IngredientItem),
            nullable=False,
            server_default=text("'[]'"),
        ),
    )
    steps: list[StepItem] = Field(
        default_factory=list,
        sa_column=Column(
            PydanticJson(StepItem),
            nullable=False,
            server_default=text("'[]'"),
        ),
    )
