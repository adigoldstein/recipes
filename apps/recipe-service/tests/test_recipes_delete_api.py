"""`DELETE /api/recipes/{id}`: editors delete a recipe with its parts (FR-10)."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app.core.errors import AppError
from app.recipes.models import Ingredient, Recipe, Step
from app.tags.models import RecipeTag, Tag
from app.users.models import User
from tests.factories import add_recipe, add_tag, add_user, ingredient, step
from tests.test_recipes_create import make_service

LOGIN = "/api/auth/login"
PASSWORD = "correct horse"


def url(recipe_id: object) -> str:
    return f"/api/recipes/{recipe_id}"


def count(session: Session, table: type) -> int:
    session.expire_all()
    return session.exec(select(func.count()).select_from(table)).one()


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return user


@pytest.fixture
def saved(session: Session) -> Recipe:
    tag = add_tag(session, "מהיר")
    return add_recipe(
        session,
        title="שקשוקה",
        tags=[tag],
        ingredients=[ingredient(0, "בצל"), ingredient(1, "מלח")],
        steps=[step(0, "מטגנים"), step(1, "מגישים")],
    )


# --- Access ------------------------------------------------------------------


def test_a_visitor_gets_401_and_nothing_is_deleted(
    client: TestClient, session: Session, saved: Recipe
) -> None:
    response = client.delete(url(saved.id))
    assert response.status_code == 401
    assert count(session, Recipe) == 1


def test_deleting_without_the_csrf_header_is_403(
    bare_client: TestClient,
    client: TestClient,
    editor: User,
    session: Session,
    saved: Recipe,
) -> None:
    bare_client.cookies.update(client.cookies)
    response = bare_client.delete(url(saved.id))
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"
    assert count(session, Recipe) == 1


# --- Delete ------------------------------------------------------------------


def test_delete_removes_the_recipe_and_its_parts_but_keeps_the_tag(
    client: TestClient, session: Session, editor: User, saved: Recipe
) -> None:
    recipe_id = saved.id  # the row is gone afterwards, so read it first
    response = client.delete(url(recipe_id))
    assert response.status_code == 204
    assert response.content == b""
    assert count(session, Recipe) == 0
    assert count(session, Ingredient) == 0
    assert count(session, Step) == 0
    assert count(session, RecipeTag) == 0
    assert session.exec(select(Tag).where(Tag.name == "מהיר")).one() is not None
    assert client.get(url(recipe_id)).status_code == 404
    assert client.get("/api/recipes").json() == []


def test_only_the_named_recipe_is_deleted(
    client: TestClient, session: Session, editor: User, saved: Recipe
) -> None:
    other = add_recipe(
        session,
        title="סלט",
        ingredients=[ingredient(0, "מלפפון")],
        steps=[step(0, "חותכים")],
    )
    assert client.delete(url(saved.id)).status_code == 204
    assert count(session, Recipe) == 1
    assert count(session, Ingredient) == 1
    assert client.get(url(other.id)).status_code == 200


def test_deleting_again_is_404(client: TestClient, editor: User, saved: Recipe) -> None:
    assert client.delete(url(saved.id)).status_code == 204
    response = client.delete(url(saved.id))
    assert response.status_code == 404
    assert response.json()["code"] == "recipe_not_found"


def test_an_unknown_recipe_is_404(client: TestClient, editor: User) -> None:
    response = client.delete(url(uuid.uuid4()))
    assert response.status_code == 404
    assert response.json()["code"] == "recipe_not_found"


def test_a_failed_delete_rolls_back(
    client: TestClient,
    session: Session,
    saved: Recipe,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = make_service(session)

    def fail() -> None:
        raise RuntimeError("disk full")

    monkeypatch.setattr(service._repository, "commit", fail)  # noqa: SLF001
    with pytest.raises(RuntimeError):
        service.delete_recipe(saved.id)
    assert count(session, Recipe) == 1
    assert count(session, Ingredient) == 2


def test_the_service_raises_not_found(client: TestClient, session: Session) -> None:
    with pytest.raises(AppError) as error:
        make_service(session).delete_recipe(uuid.uuid4())
    assert error.value.status_code == 404
