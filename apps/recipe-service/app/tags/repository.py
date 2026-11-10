"""Database queries for tags. Only this module's service uses them."""

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, func
from sqlmodel import Session, col, select

from app.tags.models import RecipeTag, Tag


class TagRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, tag_id: uuid.UUID) -> Tag | None:
        return self._session.get(Tag, tag_id)

    def get_by_name(self, name: str) -> Tag | None:
        """Finds the tag with this name, ignoring upper and lower case (AD-7)."""
        statement = select(Tag).where(func.lower(col(Tag.name)) == name.lower())
        return self._session.exec(statement).first()

    def add(self, tag: Tag) -> Tag:
        self._session.add(tag)
        self._session.flush()
        return tag

    def link(self, recipe_id: uuid.UUID, tag_id: uuid.UUID) -> None:
        self._session.add(RecipeTag(recipe_id=recipe_id, tag_id=tag_id))
        self._session.flush()

    def unlink_all(self, recipe_id: uuid.UUID) -> None:
        self._session.exec(
            delete(RecipeTag).where(col(RecipeTag.recipe_id) == recipe_id)
        )

    def list_for_recipes(
        self, recipe_ids: Sequence[uuid.UUID]
    ) -> Sequence[tuple[uuid.UUID, Tag]]:
        """Returns (recipe id, tag) pairs for the given recipes, in display order."""
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

    def list_all_with_counts(self) -> Sequence[tuple[Tag, int]]:
        """Returns every tag with its number of recipes. Pinned tags first, then by
        name."""
        statement = (
            select(Tag, func.count(col(RecipeTag.recipe_id)))
            .join(RecipeTag, col(RecipeTag.tag_id) == col(Tag.id), isouter=True)
            .group_by(col(Tag.id))
            .order_by(
                col(Tag.sort_order).asc().nulls_last(),
                func.lower(col(Tag.name)),
                col(Tag.id),
            )
        )
        return [(tag, count) for tag, count in self._session.exec(statement)]

    def count_recipes(self, tag_id: uuid.UUID) -> int:
        statement = select(func.count()).where(col(RecipeTag.tag_id) == tag_id)
        return self._session.exec(statement).one()

    def next_sort_order(self) -> int:
        """Returns the next free position, so a newly pinned tag is added at the end."""
        top = self._session.exec(select(func.max(col(Tag.sort_order)))).one()
        return 0 if top is None else top + 1

    def delete(self, tag: Tag) -> None:
        """Deletes the tag and its links to recipes."""
        self._session.exec(delete(RecipeTag).where(col(RecipeTag.tag_id) == tag.id))
        self._session.delete(tag)
        self._session.flush()

    def commit(self) -> None:
        self._session.commit()
