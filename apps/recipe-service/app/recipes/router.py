import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.errors import ErrorResponse
from app.recipes.schemas import RecipeRead, RecipeSummary
from app.recipes.service import RecipeService, get_recipe_service

router = APIRouter(prefix="/recipes", tags=["recipes"])

ServiceDep = Annotated[RecipeService, Depends(get_recipe_service)]


@router.get("")
def list_recipes(service: ServiceDep) -> list[RecipeSummary]:
    return service.list_recipes()


@router.get("/{recipe_id}", responses={404: {"model": ErrorResponse}})
def get_recipe(recipe_id: uuid.UUID, service: ServiceDep) -> RecipeRead:
    return service.get_recipe(recipe_id)
