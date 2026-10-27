"""Database access for tags; used only by this module's service."""

import uuid
from collections.abc import Sequence

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.tags.models import RecipeTag, Tag


class TagRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, tag_id: uuid.UUID) -> Tag | None:
        return self._session.get(Tag, tag_id)

    def get_by_name(self, name: str) -> Tag | None:
        """The tag with this name, compared case-insensitively (AD-7)."""
        statement = select(Tag).where(func.lower(col(Tag.name)) == name.lower())
        return self._session.exec(statement).first()

    def add(self, tag: Tag) -> Tag:
        self._session.add(tag)
        self._session.flush()
        return tag

    def link(self, recipe_id: uuid.UUID, tag_id: uuid.UUID) -> None:
        self._session.add(RecipeTag(recipe_id=recipe_id, tag_id=tag_id))
        self._session.flush()

    def list_for_recipes(
        self, recipe_ids: Sequence[uuid.UUID]
    ) -> Sequence[tuple[uuid.UUID, Tag]]:
        """Every (recipe id, tag) pair for the recipes, in a stable display order."""
        statement = (
            select(RecipeTag.recipe_id, Tag)
            .join(Tag, col(RecipeTag.tag_id) == col(Tag.id))
            .where(col(RecipeTag.recipe_id).in_(recipe_ids))
            .order_by(
                col(Tag.sort_order).asc().nulls_last(),
                func.lower(col(Tag.name)),
                col(Tag.id),
            )
        )
        return [(recipe_id, tag) for recipe_id, tag in self._session.exec(statement)]
