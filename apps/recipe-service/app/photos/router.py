from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile

from app.core.errors import ErrorResponse
from app.core.security import CurrentUser, require_role
from app.photos.schemas import PhotoLimits, PhotoUploaded
from app.photos.service import PhotoService, get_photo_service

router = APIRouter(prefix="/photos", tags=["photos"])

ServiceDep = Annotated[PhotoService, Depends(get_photo_service)]
EditorDep = Annotated[CurrentUser, Depends(require_role("editor"))]


@router.get("/limits", responses={401: {"model": ErrorResponse}})
def get_limits(service: ServiceDep, _: EditorDep) -> PhotoLimits:
    return service.limits()


@router.post(
    "",
    status_code=201,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
    },
)
def upload_photo(file: UploadFile, service: ServiceDep, _: EditorDep) -> PhotoUploaded:
    # One byte past the limit is enough to know the file is too big.
    data = file.file.read(service.limits().max_bytes + 1)
    return PhotoUploaded(photo_key=service.store(data))
