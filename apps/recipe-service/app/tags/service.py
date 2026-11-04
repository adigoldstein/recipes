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
from app.tags.schemas import TagCreate, TagInput, TagRead, TagRef, TagUpdate


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
            _read(tag, count) for tag, count in self._repository.list_all_with_counts()
        ]

    def create_tag(self, data: TagCreate) -> TagRead:
        self._ensure_name_free(data.name)
        tag = self._repository.add(Tag(name=data.name))
        self._repository.commit()
        return _read(tag, 0)

    def update_tag(self, tag_id: uuid.UUID, data: TagUpdate) -> TagRead:
        """Rename and/or pin a tag. Pinning goes last in the chip row (FR23)."""
        tag = self._get(tag_id)
        if data.name is not None and data.name != tag.name:
            self._ensure_name_free(data.name, except_id=tag.id)
            tag.name = data.name
        if data.pinned is True and not tag.pinned:
            tag.pinned = True
            tag.sort_order = self._repository.next_sort_order()
        elif data.pinned is False and tag.pinned:
            tag.pinned = False
            tag.sort_order = None
        self._repository.add(tag)
        self._repository.commit()
        return _read(tag, self._repository.count_recipes(tag.id))

    def delete_tag(self, tag_id: uuid.UUID) -> None:
        self._repository.delete(self._get(tag_id))
        self._repository.commit()

    def _get(self, tag_id: uuid.UUID) -> Tag:
        tag = self._repository.get(tag_id)
        if tag is None:
            raise AppError(404, ErrorCode.TAG_NOT_FOUND, "Tag not found")
        return tag

    def _ensure_name_free(self, name: str, except_id: uuid.UUID | None = None) -> None:
        taken = self._repository.get_by_name(name)
        if taken is not None and taken.id != except_id:
            raise AppError(409, ErrorCode.TAG_NAME_TAKEN, "Tag name already exists")

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

    def replace_for_recipe(
        self, recipe_id: uuid.UUID, refs: Sequence[TagInput]
    ) -> None:
        """Make `refs` the recipe's whole tag list; the caller's transaction commits."""
        self._repository.unlink_all(recipe_id)
        self.assign_to_recipe(recipe_id, refs)

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


def _read(tag: Tag, recipe_count: int) -> TagRead:
    return TagRead(
        id=tag.id, name=tag.name, pinned=tag.pinned, recipe_count=recipe_count
    )


def get_tag_service(session: Annotated[Session, Depends(get_session)]) -> TagService:
    """Provider, like a Nest injectable: `Depends(get_tag_service)`."""
    return TagService(TagRepository(session))
