from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["health"])


class HealthRead(BaseModel):
    status: Literal["ok"]


@router.get("")
def get_health() -> HealthRead:
    return HealthRead(status="ok")
