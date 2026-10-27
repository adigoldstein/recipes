"""Business rules for recipes; other modules call this layer, never the repository."""

import uuid
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.recipes.models import Ingredient
from app.recipes.repository import RecipeRepository
from app.recipes.schemas import (
    IngredientRead,
    OriginalValue,
    RecipeRead,
    RecipeSummary,
    SourceValue,
    StepRead,
)
from app.tags.service import TagService, get_tag_service


def total_minutes(prep: int | None, cook: int | None) -> int | None:
    """Prep plus cook; a missing one counts as 0, and none known means unknown."""
    if prep is None and cook is None:
        return None
    return (prep or 0) + (cook or 0)


def _ingredient_read(ingredient: Ingredient) -> IngredientRead:
    original = (
        OriginalValue(amount=ingredient.original_amount, unit=ingredient.original_unit)
        if ingredient.has_original
        else None
    )
    source = (
        SourceValue(amount=ingredient.source_amount, unit=ingredient.source_unit)
        if ingredient.source_amount is not None and ingredient.source_unit is not None
        else None
    )
    return IngredientRead(
        id=ingredient.id,
        name=ingredient.name,
        amount=ingredient.amount,
        unit=ingredient.unit,
        note=ingredient.note,
        original=original,
        source=source,
    )


class RecipeService:
    def __init__(self, repository: RecipeRepository, tags: TagService) -> None:
        self._repository = repository
        self._tags = tags

    def list_recipes(self) -> list[RecipeSummary]:
        recipes = self._repository.list_all()
        tags = self._tags.get_tags([recipe.id for recipe in recipes])
        return [
            RecipeSummary(
                id=recipe.id,
                title=recipe.title,
                tags=tags[recipe.id],
                total_minutes=total_minutes(
                    recipe.prep_time_minutes, recipe.cook_time_minutes
                ),
                photo=None,  # Photos arrive with Story 3.7.
                created_at=recipe.created_at,
            )
            for recipe in recipes
        ]

    def get_recipe(self, recipe_id: uuid.UUID) -> RecipeRead:
        recipe = self._repository.get(recipe_id)
        if recipe is None:
            raise AppError(404, ErrorCode.RECIPE_NOT_FOUND, "Recipe not found")
        tags = self._tags.get_tags([recipe.id])[recipe.id]
        return RecipeRead(
            id=recipe.id,
            title=recipe.title,
            description=recipe.description,
            notes=recipe.notes,
            tags=tags,
            base_servings=recipe.base_servings,
            prep_time_minutes=recipe.prep_time_minutes,
            cook_time_minutes=recipe.cook_time_minutes,
            source_url=recipe.source_url,
            photo=None,  # Photos arrive with Story 3.7.
            ingredients=[_ingredient_read(item) for item in recipe.ingredients],
            steps=[
                StepRead(
                    id=step.id,
                    description=step.description,
                    source_text=step.source_text,
                )
                for step in recipe.steps
            ],
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        )


def get_recipe_service(
    session: Annotated[Session, Depends(get_session)],
    tags: Annotated[TagService, Depends(get_tag_service)],
) -> RecipeService:
    """Provider, like a Nest injectable: `Depends(get_recipe_service)`."""
    return RecipeService(RecipeRepository(session), tags)
