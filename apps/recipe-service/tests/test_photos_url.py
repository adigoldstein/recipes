"""A photo from a link (Story 5.4): `POST /api/photos/url`, and the photo credit when
the recipe is saved."""

from collections.abc import Callable
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import get_settings
from app.core.safe_fetch import FetchedResponse, FetchFailedError, FetchLimits, safe_get
from app.photos.service import PhotoService, UploadLimits, get_photo_service
from app.photos.storage import LocalPhotoStorage
from app.users.models import User
from tests.factories import add_user
from tests.images import jpeg

LOGIN = "/api/auth/login"
PASSWORD = "correct horse"
URL = "/api/photos/url"
RECIPES = "/api/recipes"

DNS = {"cdn.example.com": ["151.101.1.1"], "example.com": ["93.184.216.34"]}

Handler = Callable[[httpx.Request], httpx.Response]


def resolver(host: str, _port: int) -> list[str]:
    if host not in DNS:
        raise FetchFailedError(f"cannot resolve {host}")
    return DNS[host]


def image(body: bytes, content_type: str = "image/jpeg", status: int = 200) -> Handler:
    def handle(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status, content=body, headers={"content-type": content_type}
        )

    return handle


@pytest.fixture
def serve(app: FastAPI) -> Callable[[Handler], None]:
    """Makes the photo service's downloads use a test handler instead of the
    network."""

    def use(handler: Handler) -> None:
        def fetch(url: str, limits: FetchLimits) -> FetchedResponse:
            return safe_get(
                url, limits, resolver=resolver, transport=httpx.MockTransport(handler)
            )

        def service() -> PhotoService:
            settings = get_settings()
            return PhotoService(
                LocalPhotoStorage(settings.data_dir / "media" / "photos"),
                UploadLimits(settings.photo_max_bytes, settings.photo_max_pixels, 5),
                fetch,
            )

        app.dependency_overrides[get_photo_service] = service

    return use


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return user


def from_url(client: TestClient, url: str) -> Any:
    return client.post(URL, json={"source_url": url})


NEW_RECIPE: dict[str, Any] = {
    "title": "עוגיות",
    "base_servings": 4,
    "ingredients": [{"name": "קמח"}],
    "steps": [{"description": "אופים"}],
}


# --- The endpoint ---------------------------------------------------------------


def test_a_visitor_cannot_download_a_photo(client: TestClient) -> None:
    assert from_url(client, "https://cdn.example.com/a.jpg").status_code == 401


def test_a_photo_from_a_link_is_stored_like_an_upload(
    client: TestClient, editor: User, serve: Callable[[Handler], None]
) -> None:
    serve(image(jpeg()))
    response = from_url(client, "https://cdn.example.com/cookies.jpg")
    assert response.status_code == 201
    key = response.json()["photo_key"]
    folder = get_settings().data_dir / "media" / "photos"
    assert (folder / f"{key}.webp").is_file()
    assert (folder / f"{key}-thumb.webp").is_file()


@pytest.mark.parametrize(
    ("url", "handler", "status", "code"),
    [
        ("http://127.0.0.1/a.jpg", image(jpeg()), 400, "fetch_blocked"),
        ("http://169.254.169.254/latest", image(jpeg()), 400, "fetch_blocked"),
        ("file:///etc/passwd", image(jpeg()), 400, "fetch_blocked"),
        (
            "https://cdn.example.com/a.jpg",
            image(b"no", status=403),
            400,
            "fetch_blocked",
        ),
        (
            "https://cdn.example.com/a.jpg",
            image(b"no", status=404),
            502,
            "fetch_failed",
        ),
        ("https://nowhere.example.org/a.jpg", image(jpeg()), 502, "fetch_failed"),
        (
            "https://cdn.example.com/a.jpg",
            image(b"<html>not an image</html>", "text/html"),
            415,
            "photo_unsupported_type",
        ),
    ],
)
def test_refused_downloads_have_stable_codes(
    url: str,
    handler: Handler,
    status: int,
    code: str,
    client: TestClient,
    editor: User,
    serve: Callable[[Handler], None],
) -> None:
    serve(handler)
    response = from_url(client, url)
    assert response.status_code == status
    assert response.json()["code"] == code


def test_a_redirect_to_a_private_address_is_blocked(
    client: TestClient, editor: User, serve: Callable[[Handler], None]
) -> None:
    serve(
        lambda _request: httpx.Response(302, headers={"location": "http://10.0.0.1/"})
    )
    response = from_url(client, "https://cdn.example.com/a.jpg")
    assert response.json()["code"] == "fetch_blocked"


def test_a_photo_over_the_size_limit_is_photo_too_large(
    client: TestClient,
    editor: User,
    serve: Callable[[Handler], None],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOTO_MAX_BYTES", "100")
    get_settings.cache_clear()
    serve(image(jpeg()))
    response = from_url(client, "https://cdn.example.com/a.jpg")
    assert response.status_code == 413
    assert response.json()["code"] == "photo_too_large"


# --- The credit (from the recipe's source link) --------------------------------


def test_a_saved_photo_is_credited_to_the_recipes_source_site(
    client: TestClient, editor: User, serve: Callable[[Handler], None]
) -> None:
    serve(image(jpeg()))
    key = from_url(client, "https://cdn.example.com/cookies.jpg").json()["photo_key"]
    recipe = client.post(
        RECIPES,
        json={
            **NEW_RECIPE,
            "source_url": "https://www.example.com/recipes/cookies",
            "photo_key": key,
        },
    ).json()
    assert recipe["photo"]["credit_domain"] == "example.com"


def test_no_source_link_means_no_credit(
    client: TestClient, editor: User, serve: Callable[[Handler], None]
) -> None:
    serve(image(jpeg()))
    key = from_url(client, "https://cdn.example.com/cookies.jpg").json()["photo_key"]
    recipe = client.post(RECIPES, json={**NEW_RECIPE, "photo_key": key}).json()
    assert recipe["photo"]["credit_domain"] is None


def test_a_photo_added_on_edit_takes_the_credit_of_the_new_source_link(
    client: TestClient, editor: User, serve: Callable[[Handler], None]
) -> None:
    serve(image(jpeg()))
    recipe = client.post(RECIPES, json=NEW_RECIPE).json()
    key = from_url(client, "https://cdn.example.com/cookies.jpg").json()["photo_key"]
    body = {
        **NEW_RECIPE,
        "source_url": "https://blog.example.com/cookies",
        "photo_key": key,
        "ingredients": [
            {"id": item["id"], "name": item["name"]} for item in recipe["ingredients"]
        ],
    }
    updated = client.put(f"{RECIPES}/{recipe['id']}", json=body).json()
    assert updated["photo"]["credit_domain"] == "blog.example.com"
