import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.errors import ErrorResponse
from app.core.security import CurrentUser, require_role
from app.recipes.schemas import RecipeCreate, RecipeRead, RecipeSummary
from app.recipes.service import RecipeService, get_recipe_service

router = APIRouter(prefix="/recipes", tags=["recipes"])

ServiceDep = Annotated[RecipeService, Depends(get_recipe_service)]
EditorDep = Annotated[CurrentUser, Depends(require_role("editor"))]


@router.get("")
def list_recipes(service: ServiceDep) -> list[RecipeSummary]:
    return service.list_recipes()


@router.get("/{recipe_id}", responses={404: {"model": ErrorResponse}})
def get_recipe(recipe_id: uuid.UUID, service: ServiceDep) -> RecipeRead:
    return service.get_recipe(recipe_id)


@router.post(
    "",
    status_code=201,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def create_recipe(
    data: RecipeCreate, service: ServiceDep, current: EditorDep
) -> RecipeRead:
    return service.create_recipe(data, current.id)
