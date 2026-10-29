"""`POST /api/recipes`: editors and admins only (FR-4, AD-20, AD-31)."""

import copy
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app.core.security import Role
from app.recipes.models import Recipe
from app.users.models import User
from tests.factories import add_user

RECIPES = "/api/recipes"
LOGIN = "/api/auth/login"
PASSWORD = "correct horse"
NEW_RECIPE: dict[str, Any] = {
    "title": "פשטידת תרד",
    "description": "פשטידה מהירה",
    "notes": "אפשר להקפיא",
    "base_servings": 4,
    "prep_time_minutes": 10,
    "cook_time_minutes": 35,
    "source_url": "https://example.com/spinach-pie",
    "tags": [],
    "ingredients": [
        {"name": "קמח", "amount": 1.5, "unit": "cup", "note": "מנופה"},
        {"name": "מלח"},
    ],
    "steps": [{"description": "מערבבים"}, {"description": "אופים"}],
}


def payload(**changes: Any) -> dict[str, Any]:
    return {**copy.deepcopy(NEW_RECIPE), **changes}


def _sign_in(client: TestClient, email: str) -> None:
    response = client.post(LOGIN, json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def _recipe_count(session: Session) -> int:
    session.expire_all()
    return session.exec(select(func.count()).select_from(Recipe)).one()


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    _sign_in(client, user.email)
    return user


# --- Access ------------------------------------------------------------------


def test_a_visitor_gets_401_and_nothing_is_created(
    client: TestClient, session: Session
) -> None:
    response = client.post(RECIPES, json=payload())
    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
    assert _recipe_count(session) == 0


def test_creating_without_the_csrf_header_is_403(
    bare_client: TestClient, client: TestClient, editor: User, session: Session
) -> None:
    bare_client.cookies.update(client.cookies)
    response = bare_client.post(RECIPES, json=payload())
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"
    assert _recipe_count(session) == 0


def test_an_admin_can_create(client: TestClient, session: Session) -> None:
    add_user(session, email="admin@example.com", role=Role.ADMIN)
    _sign_in(client, "admin@example.com")
    assert client.post(RECIPES, json=payload()).status_code == 201


def test_the_role_guard_answers_before_validation(client: TestClient) -> None:
    # A visitor learns nothing about the schema from the errors.
    assert client.post(RECIPES, json={}).status_code == 401


# --- Success -----------------------------------------------------------------


def test_create_returns_the_full_recipe_and_records_the_author(
    client: TestClient, session: Session, editor: User
) -> None:
    response = client.post(RECIPES, json=payload())
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "פשטידת תרד"
    assert body["notes"] == "אפשר להקפיא"
    assert body["base_servings"] == 4
    assert body["tags"] == []
    assert body["photo"] is None
    assert [i["name"] for i in body["ingredients"]] == ["קמח", "מלח"]
    assert body["ingredients"][0]["amount"] == 1.5
    assert body["ingredients"][0]["unit"] == "cup"
    assert body["ingredients"][1]["amount"] is None
    assert body["ingredients"][1]["unit"] is None
    assert [s["description"] for s in body["steps"]] == ["מערבבים", "אופים"]

    stored = session.get(Recipe, uuid.UUID(body["id"]))
    assert stored is not None
    assert stored.created_by == editor.id
    assert stored.updated_by == editor.id
    assert client.get(f"{RECIPES}/{body['id']}").json() == body


def test_the_new_recipe_shows_in_the_list(client: TestClient, editor: User) -> None:
    created = client.post(RECIPES, json=payload()).json()
    [summary] = client.get(RECIPES).json()
    assert summary["id"] == created["id"]
    assert summary["total_minutes"] == 45


def test_amounts_are_quantized_to_three_decimals(
    client: TestClient, editor: User
) -> None:
    body = payload(ingredients=[{"name": "שמן", "amount": 0.33333, "unit": "cup"}])
    created = client.post(RECIPES, json=body).json()
    assert created["ingredients"][0]["amount"] == 0.333


def test_the_optional_fields_can_be_left_out(client: TestClient, editor: User) -> None:
    body = {
        "title": "סלט",
        "base_servings": 2,
        "ingredients": [{"name": "עגבנייה"}],
        "steps": [{"description": "חותכים"}],
    }
    created = client.post(RECIPES, json=body).json()
    assert created["description"] is None
    assert created["notes"] is None
    assert created["prep_time_minutes"] is None
    assert created["source_url"] is None


def test_limits_exactly_at_the_maximum_are_accepted(
    client: TestClient, editor: User
) -> None:
    body = payload(
        title="א" * 120,
        description="א" * 500,
        notes="א" * 5000,
        base_servings=100,
    )
    assert client.post(RECIPES, json=body).status_code == 201


# --- Validation --------------------------------------------------------------


@pytest.mark.parametrize(
    ("changes", "loc", "error_type"),
    [
        ({"title": ""}, ["body", "title"], "string_too_short"),
        ({"title": "א" * 121}, ["body", "title"], "string_too_long"),
        ({"description": "א" * 501}, ["body", "description"], "string_too_long"),
        ({"notes": "א" * 5001}, ["body", "notes"], "string_too_long"),
        ({"base_servings": 0}, ["body", "base_servings"], "greater_than_equal"),
        ({"base_servings": 101}, ["body", "base_servings"], "less_than_equal"),
        ({"ingredients": []}, ["body", "ingredients"], "too_short"),
        ({"steps": []}, ["body", "steps"], "too_short"),
        (
            {"ingredients": [{"name": ""}]},
            ["body", "ingredients", 0, "name"],
            "string_too_short",
        ),
        (
            {"ingredients": [{"name": "קמח", "amount": 0}]},
            ["body", "ingredients", 0, "amount"],
            "greater_than",
        ),
        (
            {"ingredients": [{"name": "קמח", "amount": 0.0004}]},
            ["body", "ingredients", 0, "amount"],
            "greater_than",
        ),
        (
            {"ingredients": [{"name": "קמח", "unit": "bucket"}]},
            ["body", "ingredients", 0, "unit"],
            "enum",
        ),
        (
            {"steps": [{"description": "א"}, {"description": ""}]},
            ["body", "steps", 1, "description"],
            "string_too_short",
        ),
        (
            {"prep_time_minutes": -1},
            ["body", "prep_time_minutes"],
            "greater_than_equal",
        ),
        ({"surprise": 1}, ["body", "surprise"], "extra_forbidden"),
        (
            {"ingredients": [{"name": "קמח", "original": {}}]},
            ["body", "ingredients", 0, "original"],
            "extra_forbidden",
        ),
    ],
)
def test_invalid_input_is_422_with_a_loc_and_type_per_field(
    client: TestClient,
    session: Session,
    editor: User,
    changes: dict[str, Any],
    loc: list[Any],
    error_type: str,
) -> None:
    response = client.post(RECIPES, json=payload(**changes))
    assert response.status_code == 422
    error = response.json()["detail"][0]
    assert error["loc"] == loc
    assert error["type"] == error_type
    assert _recipe_count(session) == 0


def test_an_unknown_tag_id_is_404_and_nothing_is_stored(
    client: TestClient, session: Session, editor: User
) -> None:
    body = payload(tags=[{"id": "00000000-0000-4000-8000-000000000000"}])
    response = client.post(RECIPES, json=body)
    assert response.status_code == 404
    assert response.json()["code"] == "tag_not_found"
    assert _recipe_count(session) == 0
