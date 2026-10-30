from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI
from fastapi.routing import APIRoute
from sqlmodel import Session
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.auth.router import router as auth_router
from app.auth.service import get_current_user
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.errors import register_error_handlers
from app.core.health import router as health_router
from app.core.migrate import run_migrations
from app.core.rate_limit import limiter
from app.core.security import get_session_user, require_csrf_header
from app.imports.router import router as imports_router
from app.photos.router import router as photos_router
from app.photos.service import MEDIA_DIR
from app.recipes.router import router as recipes_router
from app.recipes.service import sweep_unattached_photos
from app.tags.router import router as tags_router
from app.users.router import router as users_router

API_PREFIX = "/api"

ROUTERS = (
    health_router,
    auth_router,
    imports_router,
    photos_router,
    recipes_router,
    tags_router,
    users_router,
)


def generate_operation_id(route: APIRoute) -> str:
    """`{tag}_{function}` keeps the generated client's hook names stable."""
    if not route.tags:
        raise RuntimeError(f"Route {route.path} has no tag; every router needs tags")
    return f"{route.tags[0]}_{route.name}"


class MediaFiles(StaticFiles):
    """`/media/*`. A photo's key is random and its bytes never change, so a browser may
    keep it for good."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Migrate the database before serving; any failure stops startup (AD-29)."""
    data_dir = get_settings().data_dir
    run_migrations(data_dir)
    with Session(get_engine(data_dir)) as session:
        sweep_unattached_photos(session)
    try:
        yield
    finally:
        get_engine(data_dir).dispose()


def create_app() -> FastAPI:
    # Validate config before anything is served, so a bad env fails at startup.
    get_settings()

    app = FastAPI(
        title="Bite & Board Recipe Service",
        generate_unique_id_function=generate_operation_id,
        lifespan=lifespan,
        # Every route, present and future, gets the CSRF check (AD-6).
        dependencies=[Depends(require_csrf_header)],
    )
    # `core` cannot import `auth`, so the guards ask a question that `auth` answers.
    app.dependency_overrides[get_session_user] = get_current_user
    app.state.limiter = limiter
    register_error_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    for router in ROUTERS:
        api.include_router(router)
    app.include_router(api)
    # Never answered by a page fallback: it is its own mount, ahead of anything else.
    media = get_settings().data_dir / MEDIA_DIR
    media.mkdir(parents=True, exist_ok=True)
    app.mount("/media", MediaFiles(directory=media), name="media")
    return app


app = create_app()
