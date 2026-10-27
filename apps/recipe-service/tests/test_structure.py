import importlib
import re
from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session

from app.core import metadata
from app.core.config import get_settings
from app.core.db import DB_FILENAME, get_engine, get_session
from app.core.errors import AppError, ErrorCode
from app.main import API_PREFIX, ROUTERS, create_app

APP_DIR = Path(__file__).resolve().parents[1] / "app"
FEATURE_MODULES = ("recipes", "tags", "auth", "users", "imports", "photos")
LAYER_FILES = ("router.py", "service.py", "repository.py", "models.py", "schemas.py")
OPERATION_ID = re.compile(r"^[a-z]+_[a-z]+(_[a-z]+)*$")


@pytest.mark.parametrize("module", FEATURE_MODULES)
def test_feature_module_has_every_layer(module: str) -> None:
    for filename in LAYER_FILES:
        assert (APP_DIR / module / filename).is_file(), f"{module}/{filename}"


@pytest.mark.parametrize("module", FEATURE_MODULES)
def test_feature_router_is_tagged_and_mounted(module: str) -> None:
    router = importlib.import_module(f"app.{module}.router").router
    assert isinstance(router, APIRouter)
    assert router.tags == [module]
    assert router.prefix == f"/{module}"
    assert router in ROUTERS


def test_layer_first_packages_are_gone() -> None:
    for old in ("api", "db", "models"):
        assert not (APP_DIR / old).exists()


def test_metadata_imports_every_module_models() -> None:
    imported = {module.__name__ for module in metadata.MODEL_MODULES}
    assert imported == {f"app.{name}.models" for name in FEATURE_MODULES}


def test_operation_ids_follow_tag_function(app: FastAPI) -> None:
    operation_ids = [
        operation["operationId"]
        for path in app.openapi()["paths"].values()
        for operation in path.values()
    ]
    assert "health_get_health" in operation_ids
    assert len(operation_ids) == len(set(operation_ids))
    assert all(OPERATION_ID.match(op) for op in operation_ids), operation_ids


def test_every_route_is_under_api(app: FastAPI) -> None:
    paths = app.openapi()["paths"]
    assert paths
    assert all(path.startswith(f"{API_PREFIX}/") for path in paths)


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        (
            {"count": 2},
            {
                "detail": "Conflict",
                "code": "recipe_not_found",
                "params": {"count": 2},
            },
        ),
        (None, {"detail": "Conflict", "code": "recipe_not_found"}),
    ],
)
def test_app_error_returns_code_shape(
    app: FastAPI, params: dict[str, str | int] | None, expected: dict[str, object]
) -> None:
    @app.get("/boom", tags=["test"])
    def get_boom() -> None:
        raise AppError(409, ErrorCode.RECIPE_NOT_FOUND, "Conflict", params=params)

    response = TestClient(app).get("/boom")
    assert response.status_code == 409
    assert response.json() == expected


def test_untagged_route_is_rejected_with_clear_message() -> None:
    app = create_app()
    with pytest.raises(RuntimeError, match="/untagged has no tag"):

        @app.get("/untagged")
        def get_untagged() -> None:
            return None


def test_session_uses_sqlite_in_data_dir(tmp_path: Path) -> None:
    sessions = get_session(get_settings())
    session = next(sessions)
    assert isinstance(session, Session)
    bind = session.get_bind()
    assert isinstance(bind, Engine)
    assert bind.url.database == str(tmp_path / "data" / DB_FILENAME)
    assert (tmp_path / "data").is_dir()
    sessions.close()


def test_session_follows_overridden_settings(tmp_path: Path) -> None:
    other = get_settings().model_copy(update={"data_dir": tmp_path / "other"})
    sessions = get_session(other)
    session = next(sessions)
    bind = session.get_bind()
    assert isinstance(bind, Engine)
    assert bind.url.database == str(tmp_path / "other" / DB_FILENAME)
    sessions.close()
    get_engine(tmp_path / "other").dispose()
