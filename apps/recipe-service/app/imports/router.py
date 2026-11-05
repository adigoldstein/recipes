from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.errors import ErrorResponse
from app.core.security import CurrentUser, require_role
from app.imports.schemas import DraftRecipe, ImportTextRequest
from app.imports.service import ImportService, get_import_service

router = APIRouter(prefix="/imports", tags=["imports"])

ServiceDep = Annotated[ImportService, Depends(get_import_service)]
EditorDep = Annotated[CurrentUser, Depends(require_role("editor"))]


@router.post(
    "/text",
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        504: {"model": ErrorResponse},
    },
)
def import_text(
    data: ImportTextRequest, service: ServiceDep, user: EditorDep
) -> DraftRecipe:
    """Turn pasted recipe text into a Hebrew draft. Nothing is saved."""
    return service.import_text(data.text, user.id)
