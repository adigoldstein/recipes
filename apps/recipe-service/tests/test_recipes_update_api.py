"""`PUT /api/recipes/{id}`: editors replace the whole recipe (FR-6..8, AD-4, AD-20)."""

import uuid
from decimal import Decimal
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.recipes.models import Ingredient, Recipe
from app.recipes.units import Unit
from app.users.models import User
from tests.factories import add_recipe, add_tag, add_user, ingredient, step

LOGIN = "/api/auth/login"
PASSWORD = "correct horse"


def url(recipe_id: object) -> str:
    return f"/api/recipes/{recipe_id}"


def _sign_in(client: TestClient, email: str) -> None:
    response = client.post(LOGIN, json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    _sign_in(client, user.email)
    return user


@pytest.fixture
def saved(session: Session) -> Recipe:
    return add_recipe(
        session,
        title="שקשוקה",
        ingredients=[
            ingredient(0, "כמון", amount=Decimal(1), unit=Unit.TSP),
            ingredient(1, "מלח"),
            ingredient(2, "בצל", amount=Decimal(1), unit=Unit.UNIT),
        ],
        steps=[step(0, "מטגנים")],
    )


def body(recipe: dict[str, Any], **changes: Any) -> dict[str, Any]:
    """The PUT body that re-sends a read recipe unchanged, then applies `changes`."""
    base = {
        "title": recipe["title"],
        "description": recipe["description"],
        "notes": recipe["notes"],
        "base_servings": recipe["base_servings"],
        "prep_time_minutes": recipe["prep_time_minutes"],
        "cook_time_minutes": recipe["cook_time_minutes"],
        "source_url": recipe["source_url"],
        "tags": [{"id": tag["id"]} for tag in recipe["tags"]],
        "ingredients": [
            {
                "id": item["id"],
                "name": item["name"],
                "amount": item["amount"],
                "unit": item["unit"],
                "note": item["note"],
            }
            for item in recipe["ingredients"]
        ],
        "steps": [{"description": s["description"]} for s in recipe["steps"]],
    }
    return {**base, **changes}


def current(client: TestClient, recipe: Recipe) -> dict[str, Any]:
    recipe_json: dict[str, Any] = client.get(url(recipe.id)).json()
    return recipe_json


# --- Access ------------------------------------------------------------------


def test_a_visitor_gets_401(client: TestClient, saved: Recipe) -> None:
    assert client.put(url(saved.id), json={}).status_code == 401


def test_putting_without_the_csrf_header_is_403(
    bare_client: TestClient, client: TestClient, editor: User, saved: Recipe
) -> None:
    bare_client.cookies.update(client.cookies)
    response = bare_client.put(url(saved.id), json={})
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"


def test_an_unknown_recipe_is_404(client: TestClient, editor: User) -> None:
    payload = {
        "title": "x",
        "base_servings": 1,
        "ingredients": [{"name": "a"}],
        "steps": [{"description": "b"}],
    }
    response = client.put(url(uuid.uuid4()), json=payload)
    assert response.status_code == 404
    assert response.json()["code"] == "recipe_not_found"


# --- Replace -----------------------------------------------------------------


def test_put_replaces_the_fields_and_records_the_editor(
    client: TestClient, session: Session, editor: User, saved: Recipe
) -> None:
    before = current(client, saved)
    payload = body(before, title="שקשוקה חריפה", notes="יותר חריף", base_servings=6)
    response = client.put(url(saved.id), json=payload)
    assert response.status_code == 200
    after = response.json()
    assert (after["title"], after["notes"], after["base_servings"]) == (
        "שקשוקה חריפה",
        "יותר חריף",
        6,
    )
    assert after["updated_at"] > before["updated_at"]
    session.expire_all()
    stored = session.get(Recipe, saved.id)
    assert stored is not None
    assert stored.updated_by == editor.id
    assert stored.created_by is None
    assert client.get(url(saved.id)).json() == after


def test_ingredients_are_matched_by_id_deleted_inserted_and_ordered(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    before = current(client, saved)
    cumin, salt, onion = before["ingredients"]
    payload = body(
        before,
        ingredients=[
            {"id": onion["id"], "name": "בצל סגול", "amount": 1, "unit": "unit"},
            {"name": "פפריקה", "amount": 2, "unit": "tsp"},
            {"id": cumin["id"], "name": "כמון", "amount": 1, "unit": "tsp"},
        ],
    )
    after = client.put(url(saved.id), json=payload).json()
    assert [i["name"] for i in after["ingredients"]] == [
        "בצל סגול",
        "פפריקה",
        "כמון",
    ]
    assert after["ingredients"][0]["id"] == onion["id"]
    assert after["ingredients"][2]["id"] == cumin["id"]
    known = {cumin["id"], salt["id"], onion["id"]}
    assert after["ingredients"][1]["id"] not in known
    assert all(i["original"] is None for i in after["ingredients"])


def test_an_ingredient_id_from_another_recipe_is_422(
    client: TestClient, session: Session, editor: User, saved: Recipe
) -> None:
    other = add_recipe(session, title="אחר", ingredients=[ingredient(0, "סוכר")])
    other_ingredient = other.ingredients[0].id
    before = current(client, saved)
    payload = body(
        before,
        ingredients=[
            {"name": "ok"},
            {"id": str(other_ingredient), "name": "סוכר"},
        ],
    )
    response = client.put(url(saved.id), json=payload)
    assert response.status_code == 422
    [error] = response.json()["detail"]
    assert error["loc"] == ["body", "ingredients", 1, "id"]
    assert error["type"] == "invalid"
    assert current(client, saved) == before
    session.expire_all()
    assert session.get(Ingredient, other_ingredient) is not None


def test_the_write_schema_still_validates(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    before = current(client, saved)
    no_ingredients = body(before, ingredients=[])
    assert client.put(url(saved.id), json=no_ingredients).status_code == 422
    assert client.put(url(saved.id), json=body(before, steps=[])).status_code == 422
    with_original = body(before)
    with_original["ingredients"][0]["original"] = {"amount": 9, "unit": "tsp"}
    assert client.put(url(saved.id), json=with_original).status_code == 422


def test_tags_are_replaced_and_new_ones_created(
    client: TestClient, session: Session, editor: User, saved: Recipe
) -> None:
    keep = add_tag(session, "מהיר")
    drop = add_tag(session, "ישן")
    first = body(
        current(client, saved), tags=[{"id": str(keep.id)}, {"id": str(drop.id)}]
    )
    assert len(client.put(url(saved.id), json=first).json()["tags"]) == 2
    second = body(current(client, saved), tags=[{"id": str(keep.id)}, {"name": "חדש"}])
    after = client.put(url(saved.id), json=second).json()
    assert sorted(tag["name"] for tag in after["tags"]) == ["חדש", "מהיר"]
    assert client.put(url(saved.id), json=body(after, tags=[])).json()["tags"] == []


def test_an_unknown_tag_rolls_the_whole_save_back(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    before = current(client, saved)
    payload = body(before, title="לא יישמר", tags=[{"id": str(uuid.uuid4())}])
    assert client.put(url(saved.id), json=payload).status_code == 404
    assert current(client, saved) == before


# --- Original values (FR-7) ---------------------------------------------------


def edit_ingredient(
    client: TestClient, recipe: Recipe, index: int, **fields: Any
) -> dict[str, Any]:
    payload = body(current(client, recipe))
    payload["ingredients"][index].update(fields)
    response = client.put(url(recipe.id), json=payload)
    assert response.status_code == 200
    edited: dict[str, Any] = response.json()["ingredients"][index]
    return edited


ONE_TSP = {"amount": 1, "unit": "tsp"}


def test_the_first_change_stores_the_original_and_later_ones_keep_it(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    assert edit_ingredient(client, saved, 0, amount=2)["original"] == ONE_TSP
    three = edit_ingredient(client, saved, 0, amount=3)
    assert (three["amount"], three["original"]) == (3, ONE_TSP)


def test_setting_the_value_back_clears_the_original(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    edit_ingredient(client, saved, 0, amount=2)
    assert edit_ingredient(client, saved, 0, amount=1)["original"] is None


def test_to_taste_counts_as_a_change_both_ways(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    taste = edit_ingredient(client, saved, 0, amount=None, unit=None)
    assert taste["original"] == ONE_TSP
    salt = edit_ingredient(client, saved, 1, amount=1, unit="tsp")
    assert salt["original"] == {"amount": None, "unit": None}
    back = edit_ingredient(client, saved, 1, amount=None, unit=None)
    assert back["original"] is None


def test_name_and_note_edits_never_create_an_original(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    edited = edit_ingredient(client, saved, 0, name="כמון טחון", note="קלוי")
    assert edited["original"] is None
    assert edited["note"] == "קלוי"


def test_thirds_compare_quantized(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    edit_ingredient(client, saved, 0, amount=0.333, unit="cup")
    again = edit_ingredient(client, saved, 0, amount=0.33333, unit="cup")
    assert again["original"] == ONE_TSP


def test_new_ingredients_never_get_an_original(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    payload = body(current(client, saved))
    payload["ingredients"].append({"name": "פפריקה", "amount": 1, "unit": "tsp"})
    added = client.put(url(saved.id), json=payload).json()["ingredients"][3]
    assert added["original"] is None
    # Editing it afterwards is an edit of an existing ingredient and does store one.
    again = body(current(client, saved))
    again["ingredients"][3]["amount"] = 5
    edited = client.put(url(saved.id), json=again).json()["ingredients"][3]
    assert edited["original"] == ONE_TSP


def test_an_unchanged_save_leaves_originals_alone(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    edit_ingredient(client, saved, 0, amount=2)
    again = client.put(url(saved.id), json=body(current(client, saved))).json()
    assert again["ingredients"][0]["original"] == ONE_TSP


def test_a_unit_given_without_an_amount_is_dropped(
    client: TestClient, editor: User, saved: Recipe
) -> None:
    payload = body(current(client, saved))
    payload["ingredients"].append({"name": "מלח גס", "unit": "tsp"})
    added = client.put(url(saved.id), json=payload).json()["ingredients"][3]
    assert (added["amount"], added["unit"]) == (None, None)
