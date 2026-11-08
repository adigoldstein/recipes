"""The built React app served by FastAPI in the Docker image (Story 6.1, AD-15)."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.security import CSRF_HEADER, CSRF_VALUE
from app.main import create_app

PAGE = "<!doctype html><title>ביס & סיר</title>"
HTML = {"accept": "text/html,application/xhtml+xml"}


@pytest.fixture
def web_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    web = tmp_path / "web"
    (web / "assets").mkdir(parents=True)
    (web / "index.html").write_text(PAGE, encoding="utf-8")
    (web / "assets" / "index-abc123.js").write_text("console.log(1)", encoding="utf-8")
    monkeypatch.setenv("WEB_DIR", str(web))
    get_settings.cache_clear()
    with TestClient(create_app(), headers={CSRF_HEADER: CSRF_VALUE}) as client:
        yield client


def test_home_and_deep_links_get_the_page(web_client: TestClient) -> None:
    for path in ("/", "/recipes/123", "/admin/users"):
        response = web_client.get(path, headers=HTML)
        assert response.status_code == 200, path
        assert response.text == PAGE
        assert response.headers["cache-control"] == "no-cache"


def test_hashed_assets_are_cached_for_good(web_client: TestClient) -> None:
    response = web_client.get("/assets/index-abc123.js")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_a_missing_asset_is_a_404_not_the_page(web_client: TestClient) -> None:
    assert web_client.get("/assets/old-999.js").status_code == 404
    assert web_client.get("/assets/old-999.js", headers=HTML).status_code == 404


def test_api_paths_never_get_the_page(web_client: TestClient) -> None:
    assert web_client.get("/api/health").json() == {"status": "ok"}
    assert web_client.get("/api/no-such-route", headers=HTML).status_code == 404
    assert web_client.post("/api/no-such-route").status_code == 404


def test_media_paths_never_get_the_page(web_client: TestClient) -> None:
    assert web_client.get("/media/missing.webp", headers=HTML).status_code == 404


def test_without_web_dir_nothing_is_served_at_root(client: TestClient) -> None:
    assert client.get("/", headers=HTML).status_code == 404
