"""`POST/PATCH/DELETE /api/tags`: editors manage tags (Story 4.1, FR23)."""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app.tags.models import RecipeTag, Tag
from app.users.models import User
from tests.factories import add_recipe, add_tag, add_user

LOGIN = "/api/auth/login"
PASSWORD = "correct horse"
TAGS = "/api/tags"


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return user


def by_name(client: TestClient, name: str) -> dict[str, Any]:
    tags: list[dict[str, Any]] = client.get(TAGS).json()
    return next(tag for tag in tags if tag["name"] == name)


# --- Access ------------------------------------------------------------------


def test_a_visitor_cannot_change_tags(client: TestClient, session: Session) -> None:
    tag = add_tag(session, "על האש")
    assert client.post(TAGS, json={"name": "חדש"}).status_code == 401
    assert client.patch(f"{TAGS}/{tag.id}", json={"name": "x"}).status_code == 401
    assert client.delete(f"{TAGS}/{tag.id}").status_code == 401


def test_writes_without_the_csrf_header_are_403(
    bare_client: TestClient, client: TestClient, editor: User
) -> None:
    bare_client.cookies.update(client.cookies)
    response = bare_client.post(TAGS, json={"name": "חדש"})
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"


# --- Add ---------------------------------------------------------------------


def test_add_creates_an_unpinned_tag_with_a_normalized_name(
    client: TestClient, editor: User
) -> None:
    response = client.post(TAGS, json={"name": "  על   האש "})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "על האש"
    assert body["pinned"] is False
    assert body["recipe_count"] == 0
    assert by_name(client, "על האש")["id"] == body["id"]


def test_add_with_a_taken_name_is_409_case_insensitive(
    client: TestClient, session: Session, editor: User
) -> None:
    add_tag(session, "Vegan")
    response = client.post(TAGS, json={"name": " vegan "})
    assert response.status_code == 409
    assert response.json()["code"] == "tag_name_taken"


@pytest.mark.parametrize("name", ["", "   ", "x" * 41])
def test_add_rejects_an_empty_or_too_long_name(
    client: TestClient, editor: User, name: str
) -> None:
    assert client.post(TAGS, json={"name": name}).status_code == 422


# --- Rename ------------------------------------------------------------------


def test_rename_shows_in_every_recipe_that_uses_the_tag(
    client: TestClient, session: Session, editor: User
) -> None:
    tag = add_tag(session, "מהיר")
    recipe = add_recipe(session, title="שקשוקה", tags=[tag])
    response = client.patch(f"{TAGS}/{tag.id}", json={"name": " מהיר מאוד "})
    assert response.status_code == 200
    assert response.json()["name"] == "מהיר מאוד"
    assert response.json()["recipe_count"] == 1
    detail = client.get(f"/api/recipes/{recipe.id}").json()
    assert [t["name"] for t in detail["tags"]] == ["מהיר מאוד"]


def test_rename_to_a_taken_name_is_409(
    client: TestClient, session: Session, editor: User
) -> None:
    add_tag(session, "חריף")
    tag = add_tag(session, "מתוק")
    response = client.patch(f"{TAGS}/{tag.id}", json={"name": "חריף"})
    assert response.status_code == 409
    assert response.json()["code"] == "tag_name_taken"


def test_changing_only_the_letter_case_of_its_own_name_is_allowed(
    client: TestClient, session: Session, editor: User
) -> None:
    tag = add_tag(session, "vegan")
    response = client.patch(f"{TAGS}/{tag.id}", json={"name": "Vegan"})
    assert response.status_code == 200
    assert response.json()["name"] == "Vegan"


def test_an_unknown_tag_is_404(client: TestClient, editor: User) -> None:
    missing = uuid.uuid4()
    patch = client.patch(f"{TAGS}/{missing}", json={"pinned": True})
    assert patch.status_code == 404
    assert patch.json()["code"] == "tag_not_found"
    assert client.delete(f"{TAGS}/{missing}").status_code == 404


# --- Pin ---------------------------------------------------------------------


def test_a_newly_pinned_tag_goes_last_among_the_pinned(
    client: TestClient, session: Session, editor: User
) -> None:
    first = add_tag(session, "אחד")
    second = add_tag(session, "שניים")
    assert client.patch(f"{TAGS}/{first.id}", json={"pinned": True}).status_code == 200
    assert client.patch(f"{TAGS}/{second.id}", json={"pinned": True}).status_code == 200
    tags = client.get(TAGS).json()
    pinned = [tag["name"] for tag in tags if tag["pinned"]]
    assert pinned[-2:] == ["אחד", "שניים"]
    assert all(not tag["pinned"] for tag in tags[len(pinned) :])


def test_unpinning_moves_the_tag_after_the_pinned_ones(
    client: TestClient, editor: User
) -> None:
    tag = by_name(client, "מרק")
    response = client.patch(f"{TAGS}/{tag['id']}", json={"pinned": False})
    assert response.status_code == 200
    assert response.json()["pinned"] is False
    flags = [t["pinned"] for t in client.get(TAGS).json()]
    assert flags == sorted(flags, reverse=True)
    assert by_name(client, "מרק")["pinned"] is False


def test_pinning_an_already_pinned_tag_keeps_its_place(
    client: TestClient, editor: User
) -> None:
    before = [tag["name"] for tag in client.get(TAGS).json()]
    tag = by_name(client, "בוקר")
    assert client.patch(f"{TAGS}/{tag['id']}", json={"pinned": True}).status_code == 200
    assert [tag["name"] for tag in client.get(TAGS).json()] == before


# --- Usage count and delete --------------------------------------------------


def test_list_reports_how_many_recipes_use_each_tag(
    client: TestClient, session: Session
) -> None:
    tag = add_tag(session, "מהיר")
    add_recipe(session, title="א", tags=[tag])
    add_recipe(session, title="ב", tags=[tag])
    assert by_name(client, "מהיר")["recipe_count"] == 2


def test_delete_removes_the_tag_from_every_recipe(
    client: TestClient, session: Session, editor: User
) -> None:
    tag = add_tag(session, "מהיר")
    keep = add_tag(session, "זול")
    recipe = add_recipe(session, title="שקשוקה", tags=[tag, keep])
    tag_id = tag.id
    response = client.delete(f"{TAGS}/{tag_id}")
    assert response.status_code == 204
    session.expire_all()
    assert session.get(Tag, tag_id) is None
    links = session.exec(select(func.count()).select_from(RecipeTag)).one()
    assert links == 1
    detail = client.get(f"/api/recipes/{recipe.id}").json()
    assert [t["name"] for t in detail["tags"]] == ["זול"]
