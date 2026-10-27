"""Database access for tags; used only by this module's service."""

import uuid
from collections.abc import Sequence

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.tags.models import RecipeTag, Tag


class TagRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

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
