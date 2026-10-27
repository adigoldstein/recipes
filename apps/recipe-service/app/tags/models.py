"""SQLModel tables owned by tags."""

import uuid

from sqlalchemy import Index, false, func
from sqlmodel import Field, SQLModel


class Tag(SQLModel, table=True):
    """One flat list of tags; a recipe has any number of them (AD-7)."""

    __tablename__ = "tag"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=40)
    # Pinned tags are the quick-filter chips in the library.
    pinned: bool = Field(default=False, sa_column_kwargs={"server_default": false()})
    # Display order of the pinned tags; unpinned tags leave it empty.
    sort_order: int | None = None


Index(
    "uq_tag_lower_name",
    func.lower(Tag.__table__.c.name),  # type: ignore[attr-defined]
    unique=True,
)


class RecipeTag(SQLModel, table=True):
    """Links a recipe to its tags. Owned by tags (AD-25)."""

    __tablename__ = "recipe_tag"

    # String references: tags must not import the recipes module.
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
