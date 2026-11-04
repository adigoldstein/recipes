import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.core.errors import ErrorResponse
from app.core.security import CurrentUser, require_role
from app.tags.schemas import TagCreate, TagRead, TagUpdate
from app.tags.service import TagService, get_tag_service

router = APIRouter(prefix="/tags", tags=["tags"])

ServiceDep = Annotated[TagService, Depends(get_tag_service)]
EditorDep = Annotated[CurrentUser, Depends(require_role("editor"))]

_WRITE_ERRORS: dict[int | str, dict[str, object]] = {
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
}


@router.get("")
def list_tags(service: ServiceDep) -> list[TagRead]:
    return service.list_tags()


@router.post(
    "",
    status_code=201,
    responses={**_WRITE_ERRORS, 409: {"model": ErrorResponse}},
)
def create_tag(data: TagCreate, service: ServiceDep, _: EditorDep) -> TagRead:
    return service.create_tag(data)


@router.patch(
    "/{tag_id}",
    responses={
        **_WRITE_ERRORS,
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
)
def update_tag(
    tag_id: uuid.UUID, data: TagUpdate, service: ServiceDep, _: EditorDep
) -> TagRead:
    return service.update_tag(tag_id, data)


@router.delete(
    "/{tag_id}",
    status_code=204,
    responses={**_WRITE_ERRORS, 404: {"model": ErrorResponse}},
)
def delete_tag(tag_id: uuid.UUID, service: ServiceDep, _: EditorDep) -> Response:
    service.delete_tag(tag_id)
    return Response(status_code=204)
