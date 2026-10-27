"""Business rules for tags; other modules call this layer, never the repository."""

import uuid
from collections.abc import Sequence
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.db import get_session
from app.tags.repository import TagRepository
from app.tags.schemas import TagRef


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


def get_tag_service(session: Annotated[Session, Depends(get_session)]) -> TagService:
    """Provider, like a Nest injectable: `Depends(get_tag_service)`."""
    return TagService(TagRepository(session))
