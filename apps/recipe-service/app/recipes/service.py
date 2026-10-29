"""Business rules for recipes; other modules call this layer, never the repository."""

import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.exceptions import RequestValidationError
from sqlmodel import Session

from app.core.db import get_session, utcnow
from app.core.errors import AppError, ErrorCode
from app.recipes.models import Ingredient, Recipe, Step
from app.recipes.originals import apply_edit
from app.recipes.repository import RecipeRepository
from app.recipes.schemas import (
    IngredientRead,
    OriginalValue,
    RecipeCreate,
    RecipeRead,
    RecipeSummary,
    RecipeUpdate,
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

    def create_recipe(
        self, data: RecipeCreate, user_id: uuid.UUID | None = None
    ) -> RecipeRead:
        """Create a recipe, its ingredients, steps and tags in one transaction.

        `user_id` is the author; the seed has none.
        """
        recipe = Recipe(
            created_by=user_id,
            updated_by=user_id,
            title=data.title,
            description=data.description,
            notes=data.notes,
            base_servings=data.base_servings,
            prep_time_minutes=data.prep_time_minutes,
            cook_time_minutes=data.cook_time_minutes,
            source_url=data.source_url,
        )
        recipe.ingredients = [
            Ingredient(
                recipe_id=recipe.id,
                position=position,
                name=item.name,
                amount=item.amount,
                unit=item.unit,
                note=item.note,
            )
            for position, item in enumerate(data.ingredients)
        ]
        recipe.steps = [
            Step(recipe_id=recipe.id, position=position, description=item.description)
            for position, item in enumerate(data.steps)
        ]
        try:
            self._repository.add(recipe)
            self._tags.assign_to_recipe(recipe.id, data.tags)
            self._repository.commit()
        except Exception:
            self._repository.rollback()
            raise
        return self.get_recipe(recipe.id)

    def update_recipe(
        self,
        recipe_id: uuid.UUID,
        data: RecipeUpdate,
        user_id: uuid.UUID | None = None,
    ) -> RecipeRead:
        """Replace the whole recipe in one transaction (AD-4, AD-20).

        Ingredients are matched by `id` and updated in place, so their originals
        survive; omitted ones are deleted and ones without an `id` are inserted.
        `user_id` is the editor; the seed has none.
        """
        recipe = self._repository.get(recipe_id)
        if recipe is None:
            raise AppError(404, ErrorCode.RECIPE_NOT_FOUND, "Recipe not found")
        existing = {item.id: item for item in recipe.ingredients}
        unknown = [
            index
            for index, item in enumerate(data.ingredients)
            if item.id is not None and item.id not in existing
        ]
        if unknown:
            raise RequestValidationError(
                [
                    {
                        "type": "invalid",
                        "loc": ("body", "ingredients", index, "id"),
                        "msg": "Ingredient does not belong to this recipe",
                        "input": str(data.ingredients[index].id),
                    }
                    for index in unknown
                ]
            )

        recipe.title = data.title
        recipe.description = data.description
        recipe.notes = data.notes
        recipe.base_servings = data.base_servings
        recipe.prep_time_minutes = data.prep_time_minutes
        recipe.cook_time_minutes = data.cook_time_minutes
        recipe.source_url = data.source_url
        recipe.updated_by = user_id
        recipe.updated_at = utcnow()

        ingredients: list[Ingredient] = []
        for position, item in enumerate(data.ingredients):
            if item.id is None:
                ingredient = Ingredient(
                    recipe_id=recipe.id,
                    position=position,
                    name=item.name,
                    amount=item.amount,
                    unit=item.unit if item.amount is not None else None,
                    note=item.note,
                )
            else:
                ingredient = existing[item.id]
                ingredient.position = position
                ingredient.name = item.name
                ingredient.note = item.note
                apply_edit(ingredient, item.amount, item.unit)
            ingredients.append(ingredient)
        recipe.ingredients = ingredients
        recipe.steps = [
            Step(recipe_id=recipe.id, position=position, description=item.description)
            for position, item in enumerate(data.steps)
        ]
        try:
            self._repository.add(recipe)
            self._tags.replace_for_recipe(recipe.id, data.tags)
            self._repository.commit()
        except Exception:
            self._repository.rollback()
            raise
        return self.get_recipe(recipe.id)

    def delete_recipe(self, recipe_id: uuid.UUID) -> None:
        """Delete the recipe with its ingredients, steps and tag links (FR-10)."""
        recipe = self._repository.get(recipe_id)
        if recipe is None:
            raise AppError(404, ErrorCode.RECIPE_NOT_FOUND, "Recipe not found")
        try:
            self._repository.delete(recipe)
            self._repository.commit()
        except Exception:
            self._repository.rollback()
            raise

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
