"""SQLModel tables owned by recipes, and the items stored inside a recipe (AD-41)."""

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


# AD-31 / AD-41: an exact `Decimal` in Python, a string with 3 decimals in the JSON
# (`"250.000"`), because a JSON number would be a float.
StoredAmount = Annotated[
    Decimal,
    AfterValidator(_quantize),
    PlainSerializer(lambda value: format(value, "f"), return_type=str),
]


class _Item(BaseModel):
    """What the stored items share.

    Frozen on purpose: SQLAlchemy cannot see an item edited in place, so a change
    must build a new item (`model_copy`) and assign a new list. Instances are checked
    again on write, so a bad value never reaches the database.
    """

    model_config = ConfigDict(
        frozen=True, extra="forbid", revalidate_instances="always"
    )


class OriginalItem(_Item):
    """The amount and unit before the first edit (FR-7); both null is "to taste"."""

    amount: StoredAmount | None
    unit: Unit | None


class SourceItem(_Item):
    """An imperial value an import converted to metric (FR-21), not the original."""

    amount: StoredAmount
    unit: SourceUnit


class IngredientItem(_Item):
    id: uuid.UUID = PydanticField(default_factory=uuid.uuid4)
    name: str
    note: str | None = None
    amount: StoredAmount | None = None
    unit: Unit | None = None
    # `None` is no original; `OriginalItem(amount=None, unit=None)` is "originally to
    # taste". There is no separate flag.
    original: OriginalItem | None = None
    source: SourceItem | None = None


class StepItem(_Item):
    id: uuid.UUID = PydanticField(default_factory=uuid.uuid4)
    description: str
    # The pre-conversion text, set only when an import converted a temperature.
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
    # The stored photo's key (AD-27), set only by a recipe save; the files live behind
    # `photos.service`. The credit domain is the source site of an imported photo.
    photo_key: str | None = Field(default=None, max_length=32)
    photo_credit_domain: str | None = Field(default=None, max_length=255)
    # String reference: recipes must not import the users module. A removed user
    # leaves their recipes behind with no author.
    created_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    updated_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)
    updated_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)

    # Array order is display order (AD-41). Always assign a new list when changing them.
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
