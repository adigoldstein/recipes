from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import PurePath

from fastapi import APIRouter, Depends, FastAPI
from fastapi.routing import APIRoute
from sqlmodel import Session
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
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
from app.demo_seed import seed_demo_on_first_start
from app.imports.router import publish_stream_events
from app.imports.router import router as imports_router
from app.photos.router import router as photos_router
from app.photos.service import MEDIA_DIR
from app.recipes.router import router as recipes_router
from app.recipes.service import sweep_unattached_photos
from app.tags.router import router as tags_router
from app.users.router import router as users_router

API_PREFIX = "/api"
FOREVER = "public, max-age=31536000, immutable"

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
            response.headers["Cache-Control"] = FOREVER
        return response


class SpaFiles(StaticFiles):
    """The built React app, served from the same origin as the API (AD-15).

    Vite names every file under `assets/` by its content hash, so those are cached for
    good. Any other path a browser navigates to (an HTML request, such as a deep link
    to `/recipes/<id>`) gets `index.html`, and React Router picks the page. `/api` and
    `/assets` are never answered with the page, so a wrong path there stays a real 404.
    """

    async def get_response(self, path: str, scope: Scope) -> Response:
        top = PurePath(path).parts[:1]
        if top == ("api",):
            raise HTTPException(status_code=404)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as error:
            # A missing asset (an old chunk after a deploy) stays a 404, never the page.
            wants_page = "text/html" in Headers(scope=scope).get("accept", "")
            if error.status_code != 404 or not wants_page or top == ("assets",):
                raise
            response = await super().get_response("index.html", scope)
        if top == ("assets",) and response.status_code == 200:
            response.headers["Cache-Control"] = FOREVER
        else:
            # index.html must be checked on every visit, so a new deploy shows at once.
            response.headers["Cache-Control"] = "no-cache"
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Migrate the database before serving; any failure stops startup (AD-29).

    An empty library then gets the demo recipes (switched off in tests and e2e).
    """
    settings = get_settings()
    data_dir = settings.data_dir
    run_migrations(data_dir)
    with Session(get_engine(data_dir)) as session:
        sweep_unattached_photos(session)
        seed_demo_on_first_start(session, enabled=settings.seed_demo)
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
    publish_stream_events(app)

    api = APIRouter(prefix=API_PREFIX)
    for router in ROUTERS:
        api.include_router(router)
    app.include_router(api)
    # Never answered by a page fallback: it is its own mount, ahead of anything else.
    media = get_settings().data_dir / MEDIA_DIR
    media.mkdir(parents=True, exist_ok=True)
    app.mount("/media", MediaFiles(directory=media), name="media")
    # Only the Docker image sets WEB_DIR; in dev, Vite serves the app on port 4200.
    # Mounted last, so `/api` routes and `/media` always win.
    web_dir = get_settings().web_dir
    if web_dir is not None:
        app.mount("/", SpaFiles(directory=web_dir), name="web")
    return app


app = create_app()
