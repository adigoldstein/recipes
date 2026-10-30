"""Photo upload, attaching a photo to a recipe, and `/media` (AD-14, AD-27)."""

import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import get_settings
from app.recipes.models import Recipe
from app.users.models import User
from tests.factories import add_recipe, add_user, ingredient, step
from tests.images import jpeg, noisy_png, png

LOGIN = "/api/auth/login"
PASSWORD = "correct horse"
RECIPES = "/api/recipes"


def media_dir() -> Path:
    return get_settings().data_dir / "media" / "photos"


def files() -> list[str]:
    folder = media_dir()
    return sorted(path.name for path in folder.iterdir()) if folder.exists() else []


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return user


def upload(client: TestClient, data: bytes, name: str = "photo.jpg") -> Any:
    return client.post("/api/photos", files={"file": (name, data, "image/jpeg")})


def new_key(client: TestClient, data: bytes | None = None) -> str:
    response = upload(client, data or jpeg())
    assert response.status_code == 201
    key: str = response.json()["photo_key"]
    return key


NEW_RECIPE: dict[str, Any] = {
    "title": "פשטידה",
    "base_servings": 4,
    "ingredients": [{"name": "ביצה"}],
    "steps": [{"description": "אופים"}],
}


def create(client: TestClient, **fields: Any) -> dict[str, Any]:
    response = client.post(RECIPES, json={**NEW_RECIPE, **fields})
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def update_body(recipe: dict[str, Any], **fields: Any) -> dict[str, Any]:
    body = {
        "title": recipe["title"],
        "base_servings": recipe["base_servings"],
        "ingredients": [
            {"id": item["id"], "name": item["name"]} for item in recipe["ingredients"]
        ],
        "steps": [{"description": item["description"]} for item in recipe["steps"]],
    }
    return {**body, **fields}


# --- Upload ------------------------------------------------------------------


def test_upload_returns_a_key_and_stores_both_files(
    client: TestClient, editor: User
) -> None:
    response = upload(client, jpeg(120, 90))
    assert response.status_code == 201
    key = response.json()["photo_key"]
    assert len(key) == 32
    assert files() == [f"{key}-thumb.webp", f"{key}.webp"]


def test_a_visitor_gets_401_and_nothing_is_stored(client: TestClient) -> None:
    assert upload(client, jpeg()).status_code == 401
    assert files() == []


def test_uploading_without_the_csrf_header_is_403(
    bare_client: TestClient, client: TestClient, editor: User
) -> None:
    bare_client.cookies.update(client.cookies)
    response = bare_client.post(
        "/api/photos", files={"file": ("p.jpg", jpeg(), "image/jpeg")}
    )
    assert response.status_code == 403
    assert files() == []


def test_a_file_that_is_not_a_picture_is_415(client: TestClient, editor: User) -> None:
    response = upload(client, b"just some text", name="cake.jpg")
    assert response.status_code == 415
    assert response.json()["code"] == "photo_unsupported_type"
    assert files() == []


def test_a_missing_file_is_422(client: TestClient, editor: User) -> None:
    assert client.post("/api/photos").status_code == 422


@pytest.fixture
def tiny_limits(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("PHOTO_MAX_BYTES", "3000")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_a_file_over_the_limit_is_413(
    tiny_limits: None, client: TestClient, editor: User
) -> None:
    response = upload(client, noisy_png())
    assert response.status_code == 413
    assert response.json()["code"] == "photo_too_large"
    assert files() == []


def test_the_limits_are_published_for_the_form(
    tiny_limits: None, client: TestClient, editor: User
) -> None:
    response = client.get("/api/photos/limits")
    assert response.status_code == 200
    assert response.json() == {
        "max_bytes": 3000,
        "content_types": ["image/jpeg", "image/png", "image/webp"],
    }


def test_the_limits_need_a_session(client: TestClient) -> None:
    assert client.get("/api/photos/limits").status_code == 401


# --- /media ------------------------------------------------------------------


def test_media_serves_the_photo_and_its_thumbnail_for_a_year(
    client: TestClient, editor: User
) -> None:
    key = new_key(client)
    for name, expected in ((f"{key}.webp", (80, 60)), (f"{key}-thumb.webp", (80, 60))):
        response = client.get(f"/media/photos/{name}")
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/webp"
        assert "immutable" in response.headers["cache-control"]
        assert response.content[:4] == b"RIFF"
        assert expected


def test_media_does_not_invent_files_and_cannot_leave_its_folder(
    client: TestClient, editor: User
) -> None:
    assert client.get(f"/media/photos/{uuid.uuid4().hex}.webp").status_code == 404
    assert client.get("/media/../app.db").status_code == 404
    assert client.get("/media/%2e%2e/app.db").status_code == 404


def test_media_is_open_to_visitors(client: TestClient, editor: User) -> None:
    key = new_key(client)
    client.cookies.clear()
    assert client.get(f"/media/photos/{key}.webp").status_code == 200


# --- Attaching a photo to a recipe -------------------------------------------


def test_a_new_recipe_can_carry_a_photo(client: TestClient, editor: User) -> None:
    key = new_key(client)
    recipe = create(client, photo_key=key)
    assert recipe["photo"] == {
        "url": f"/media/photos/{key}.webp",
        "thumb_url": f"/media/photos/{key}-thumb.webp",
        "credit_domain": None,
    }
    summary = client.get(RECIPES).json()[0]
    assert summary["photo"]["thumb_url"] == f"/media/photos/{key}-thumb.webp"
    assert client.get(f"{RECIPES}/{recipe['id']}").json()["photo"] == recipe["photo"]


def test_a_recipe_without_a_photo_has_none(client: TestClient, editor: User) -> None:
    recipe = create(client)
    assert recipe["photo"] is None
    assert client.get(RECIPES).json()[0]["photo"] is None


def test_an_unknown_photo_key_is_404_and_nothing_is_saved(
    client: TestClient, editor: User
) -> None:
    response = client.post(RECIPES, json={**NEW_RECIPE, "photo_key": uuid.uuid4().hex})
    assert response.status_code == 404
    assert response.json()["code"] == "photo_not_found"
    assert client.get(RECIPES).json() == []


@pytest.mark.parametrize("bad", ["../../x", "short", "G" * 32, ""])
def test_a_malformed_photo_key_is_422(
    client: TestClient, editor: User, bad: str
) -> None:
    response = client.post(RECIPES, json={**NEW_RECIPE, "photo_key": bad})
    assert response.status_code == 422


def test_leaving_the_photo_out_of_an_update_keeps_it(
    client: TestClient, editor: User
) -> None:
    key = new_key(client)
    recipe = create(client, photo_key=key)
    body = update_body(recipe, title="פשטידה חדשה")
    assert "photo_key" not in body
    updated = client.put(f"{RECIPES}/{recipe['id']}", json=body).json()
    assert updated["title"] == "פשטידה חדשה"
    assert updated["photo"] == recipe["photo"]
    assert f"{key}.webp" in files()


def test_null_removes_the_photo_and_deletes_its_files(
    client: TestClient, editor: User
) -> None:
    recipe = create(client, photo_key=new_key(client))
    updated = client.put(
        f"{RECIPES}/{recipe['id']}", json=update_body(recipe, photo_key=None)
    ).json()
    assert updated["photo"] is None
    assert files() == []


def test_a_new_key_replaces_the_photo_and_deletes_the_old_files(
    client: TestClient, editor: User
) -> None:
    old = new_key(client)
    recipe = create(client, photo_key=old)
    new = new_key(client, png())
    updated = client.put(
        f"{RECIPES}/{recipe['id']}", json=update_body(recipe, photo_key=new)
    ).json()
    assert updated["photo"]["url"] == f"/media/photos/{new}.webp"
    assert files() == [f"{new}-thumb.webp", f"{new}.webp"]


def test_sending_the_same_key_again_changes_nothing(
    client: TestClient, editor: User
) -> None:
    key = new_key(client)
    recipe = create(client, photo_key=key)
    client.put(f"{RECIPES}/{recipe['id']}", json=update_body(recipe, photo_key=key))
    assert files() == [f"{key}-thumb.webp", f"{key}.webp"]


def test_an_unknown_key_on_an_update_keeps_the_old_photo(
    client: TestClient, editor: User
) -> None:
    key = new_key(client)
    recipe = create(client, photo_key=key)
    response = client.put(
        f"{RECIPES}/{recipe['id']}",
        json=update_body(recipe, photo_key=uuid.uuid4().hex),
    )
    assert response.status_code == 404
    assert client.get(f"{RECIPES}/{recipe['id']}").json()["photo"] == recipe["photo"]
    assert f"{key}.webp" in files()


def test_a_failed_save_does_not_delete_the_old_photo(
    client: TestClient, editor: User
) -> None:
    key = new_key(client)
    recipe = create(client, photo_key=key)
    response = client.put(
        f"{RECIPES}/{recipe['id']}",
        json=update_body(recipe, photo_key=None, tags=[{"id": str(uuid.uuid4())}]),
    )
    assert response.status_code == 404
    assert client.get(f"{RECIPES}/{recipe['id']}").json()["photo"] is not None
    assert f"{key}.webp" in files()


def test_a_replaced_photo_drops_its_credit(
    client: TestClient, session: Session, editor: User
) -> None:
    key = new_key(client)
    recipe = add_recipe(
        session,
        title="עם קרדיט",
        ingredients=[ingredient(0, "בצל")],
        steps=[step(0, "מטגנים")],
        photo_key=key,
        photo_credit_domain="commons.wikimedia.org",
    )
    shown = client.get(f"{RECIPES}/{recipe.id}").json()
    assert shown["photo"]["credit_domain"] == "commons.wikimedia.org"

    new = new_key(client)
    updated = client.put(
        f"{RECIPES}/{recipe.id}", json=update_body(shown, photo_key=new)
    ).json()
    assert updated["photo"]["credit_domain"] is None


def test_deleting_a_recipe_deletes_its_photo_files(
    client: TestClient, session: Session, editor: User
) -> None:
    recipe = create(client, photo_key=new_key(client))
    other = new_key(client)
    assert client.delete(f"{RECIPES}/{recipe['id']}").status_code == 204
    assert files() == [f"{other}-thumb.webp", f"{other}.webp"]
    session.expire_all()
    assert session.get(Recipe, uuid.UUID(recipe["id"])) is None


def test_startup_sweeps_old_unattached_photos(
    client: TestClient, session: Session, editor: User
) -> None:
    import os
    import time

    from app.recipes.service import sweep_unattached_photos

    attached = new_key(client)
    create(client, photo_key=attached)
    orphan = new_key(client)
    young = new_key(client)
    old = time.time() - 2 * 86400
    for key in (attached, orphan):
        os.utime(media_dir() / f"{key}.webp", (old, old))

    assert sweep_unattached_photos(session) == 1
    assert f"{orphan}.webp" not in files()
    assert f"{attached}.webp" in files()
    assert f"{young}.webp" in files()
