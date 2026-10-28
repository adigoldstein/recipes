"""Business rules for tags; other modules call this layer, never the repository."""

import uuid
from collections.abc import Sequence
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.tags.models import Tag
from app.tags.repository import TagRepository
from app.tags.schemas import TagInput, TagRead, TagRef


class TagService:
    def __init__(self, repository: TagRepository) -> None:
        self._repository = repository

    def get_tags(
        self, recipe_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, list[TagRef]]:
        """Tags for each recipe (pinned first, then by name), in one query (no N+1)."""
        tags: dict[uuid.UUID, list[TagRef]] = {
            recipe_id: [] for recipe_id in recipe_ids
        }
        for recipe_id, tag in self._repository.list_for_recipes(recipe_ids):
            tags[recipe_id].append(TagRef(id=tag.id, name=tag.name))
        return tags

    def list_tags(self) -> list[TagRead]:
        """Every tag, pinned first, then by name."""
        return [
            TagRead(id=tag.id, name=tag.name, pinned=tag.pinned)
            for tag in self._repository.list_all()
        ]

    def assign_to_recipe(self, recipe_id: uuid.UUID, refs: Sequence[TagInput]) -> None:
        """Link the recipe to each tag, creating tags given by a new name (AD-25).

        Flushes but never commits: the caller's transaction owns the commit.
        """
        linked: set[uuid.UUID] = set()
        for ref in refs:
            tag = self._resolve(ref)
            if tag.id not in linked:
                linked.add(tag.id)
                self._repository.link(recipe_id, tag.id)

    def _resolve(self, ref: TagInput) -> Tag:
        if ref.id is not None:
            tag = self._repository.get(ref.id)
            if tag is None:
                raise AppError(404, ErrorCode.TAG_NOT_FOUND, "Tag not found")
            return tag
        name = ref.name or ""  # TagInput guarantees a normalized name when no id.
        return self._repository.get_by_name(name) or self._repository.add(
            Tag(name=name)
        )


def get_tag_service(session: Annotated[Session, Depends(get_session)]) -> TagService:
    """Provider, like a Nest injectable: `Depends(get_tag_service)`."""
    return TagService(TagRepository(session))
