"""SQLModel tables owned by recipes."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Index, Text, false
from sqlmodel import Field, Relationship, SQLModel

from app.core.db import Quantity, UtcDateTime, enum_column, utcnow
from app.recipes.units import SourceUnit, Unit


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
    # Their foreign key to `user` arrives in Story 2.1.
    created_by: uuid.UUID | None = None
    updated_by: uuid.UUID | None = None
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)
    updated_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)

    ingredients: list["Ingredient"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={
            "order_by": "Ingredient.position",
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
        },
    )
    steps: list["Step"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={
            "order_by": "Step.position",
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
        },
    )


class Ingredient(SQLModel, table=True):
    __tablename__ = "ingredient"
    __table_args__ = (
        Index("ix_ingredient_recipe_id_position", "recipe_id", "position"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", ondelete="CASCADE")
    position: int
    name: str
    note: str | None = None
    amount: Decimal | None = Field(default=None, sa_type=Quantity)
    unit: Unit | None = Field(
        default=None, sa_column=enum_column(Unit, "unit", nullable=True)
    )
    # FR-7 original. `has_original` tells "originally to taste" (both NULL) from none.
    has_original: bool = Field(
        default=False, sa_column_kwargs={"server_default": false()}
    )
    original_amount: Decimal | None = Field(default=None, sa_type=Quantity)
    original_unit: Unit | None = Field(
        default=None, sa_column=enum_column(Unit, "original_unit", nullable=True)
    )
    # Set only when an import converted the value (FR-21); not the FR-7 original.
    source_amount: Decimal | None = Field(default=None, sa_type=Quantity)
    source_unit: SourceUnit | None = Field(
        default=None, sa_column=enum_column(SourceUnit, "source_unit", nullable=True)
    )

    recipe: Recipe = Relationship(back_populates="ingredients")


class Step(SQLModel, table=True):
    __tablename__ = "step"
    __table_args__ = (Index("ix_step_recipe_id_position", "recipe_id", "position"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", ondelete="CASCADE")
    position: int
    description: str = Field(sa_type=Text)
    # The pre-conversion text, set only when an import converted a temperature.
    source_text: str | None = Field(default=None, sa_type=Text)

    recipe: Recipe = Relationship(back_populates="steps")
