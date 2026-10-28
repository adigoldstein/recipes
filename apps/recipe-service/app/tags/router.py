from typing import Annotated

from fastapi import APIRouter, Depends

from app.tags.schemas import TagRead
from app.tags.service import TagService, get_tag_service

router = APIRouter(prefix="/tags", tags=["tags"])

ServiceDep = Annotated[TagService, Depends(get_tag_service)]


@router.get("")
def list_tags(service: ServiceDep) -> list[TagRead]:
    return service.list_tags()
