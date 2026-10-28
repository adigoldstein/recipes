import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.errors import ErrorResponse
from app.core.security import Role, require_role
from app.users.schemas import UserCreate, UserCreateRequest, UserRead, UserUpdate
from app.users.service import UserService, get_user_service

# Every route here is admin only (AD-30); the dependency also yields the caller.
router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_role(Role.ADMIN))],
)

ServiceDep = Annotated[UserService, Depends(get_user_service)]


@router.get("")
def list_users(service: ServiceDep) -> list[UserRead]:
    return service.list_users()


@router.post("", status_code=201, responses={409: {"model": ErrorResponse}})
def create_user(body: UserCreateRequest, service: ServiceDep) -> UserRead:
    account = UserCreate(email=body.email, name=body.name, role=body.role)
    return service.create_user(account, body.password)


@router.patch(
    "/{user_id}",
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
def update_user(user_id: uuid.UUID, body: UserUpdate, service: ServiceDep) -> UserRead:
    return service.update_user(user_id, body)
