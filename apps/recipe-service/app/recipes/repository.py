"""Database access for recipes; used only by this module's service."""

import uuid
from collections.abc import Sequence
from typing import Any, cast

from sqlalchemy.orm import QueryableAttribute, selectinload
from sqlmodel import Session, col, select

from app.recipes.models import Recipe


def _attribute(relationship: object) -> "QueryableAttribute[Any]":
    """SQLModel types relationships as plain lists; at runtime they are attributes."""
    return cast("QueryableAttribute[Any]", relationship)


class RecipeRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_all(self) -> Sequence[Recipe]:
        """Every recipe, newest first (AD-26); children are not loaded."""
        statement = select(Recipe).order_by(
            col(Recipe.created_at).desc(), col(Recipe.id)
        )
        return self._session.exec(statement).all()

    def add(self, recipe: Recipe) -> Recipe:
        """Stage the recipe with its ingredients and steps; the caller commits."""
        self._session.add(recipe)
        self._session.flush()
        return recipe

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()

    def get(self, recipe_id: uuid.UUID) -> Recipe | None:
        """One recipe with its ingredients and steps, both ordered by position."""
        statement = (
            select(Recipe)
            .where(Recipe.id == recipe_id)
            .options(
                selectinload(_attribute(Recipe.ingredients)),
                selectinload(_attribute(Recipe.steps)),
            )
        )
        return self._session.exec(statement).first()
