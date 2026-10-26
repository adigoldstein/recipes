from fastapi import APIRouter, FastAPI
from fastapi.routing import APIRoute

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.health import router as health_router
from app.imports.router import router as imports_router
from app.photos.router import router as photos_router
from app.recipes.router import router as recipes_router
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


def create_app() -> FastAPI:
    # Validate config before anything is served, so a bad env fails at startup.
    get_settings()

    app = FastAPI(
        title="Bite & Board Recipe Service",
        generate_unique_id_function=generate_operation_id,
    )
    register_error_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    for router in ROUTERS:
        api.include_router(router)
    app.include_router(api)
    return app


app = create_app()
