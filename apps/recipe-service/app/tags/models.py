"""The database tables of the tags module."""

import uuid

from sqlalchemy import Index, false, func
from sqlmodel import Field, SQLModel


class Tag(SQLModel, table=True):
    """A tag. All tags are in one flat list, and a recipe can have any number of
    them (AD-7)."""

    __tablename__ = "tag"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=40)
    # Pinned tags appear as quick filter chips in the library.
    pinned: bool = Field(default=False, sa_column_kwargs={"server_default": false()})
    # The order of the pinned tags on screen. Empty for tags that are not pinned.
    sort_order: int | None = None


Index(
    "uq_tag_lower_name",
    func.lower(Tag.__table__.c.name),  # type: ignore[attr-defined]
    unique=True,
)


class RecipeTag(SQLModel, table=True):
    """Connects a recipe to a tag. This table belongs to the tags module (AD-25)."""

    __tablename__ = "recipe_tag"

    # The foreign key is written as a string because tags may not import recipes.
    recipe_id: uuid.UUID = Field(
        foreign_key="recipe.id",
        ondelete="CASCADE",
        primary_key=True,
    )
    tag_id: uuid.UUID = Field(
        foreign_key="tag.id",
        ondelete="CASCADE",
        primary_key=True,
    )
