"""Database queries for recipes. Only this module's service uses them."""

import uuid
from collections.abc import Sequence
from typing import Any, cast

from sqlalchemy.orm import QueryableAttribute, defer
from sqlmodel import Session, col, select

from app.recipes.models import Recipe


def _attribute(column: object) -> "QueryableAttribute[Any]":
    """Fixes the type of a column for the type checker.

    SQLModel types columns as plain values, but when the code runs they are query
    attributes.
    """
    return cast("QueryableAttribute[Any]", column)


class RecipeRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_all(self) -> Sequence[Recipe]:
        """Returns all recipes, newest first (AD-26), without ingredients and steps."""
        statement = (
            select(Recipe)
            .order_by(col(Recipe.created_at).desc(), col(Recipe.id))
            .options(
                defer(_attribute(Recipe.ingredients)),
                defer(_attribute(Recipe.steps)),
            )
        )
        return self._session.exec(statement).all()

    def photo_keys(self) -> set[str]:
        """Returns the keys of all the photos that recipes use."""
        statement = select(Recipe.photo_key).where(col(Recipe.photo_key).is_not(None))
        return {key for key in self._session.exec(statement) if key is not None}

    def add(self, recipe: Recipe) -> Recipe:
        """Adds the recipe, with its ingredients and steps, to the session. The caller
        commits."""
        self._session.add(recipe)
        self._session.flush()
        return recipe

    def delete(self, recipe: Recipe) -> None:
        """Deletes the recipe in the session. The database deletes its tag links too."""
        self._session.delete(recipe)
        self._session.flush()

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()

    def get(self, recipe_id: uuid.UUID) -> Recipe | None:
        """Returns one recipe, with its ingredients and steps in order."""
        statement = select(Recipe).where(Recipe.id == recipe_id)
        return self._session.exec(statement).first()
