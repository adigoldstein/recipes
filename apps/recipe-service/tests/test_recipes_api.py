import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.recipes.service import total_minutes
from app.recipes.units import SourceUnit, Unit
from tests.factories import add_recipe, add_tag, ingredient, seeded_tag, step


def at(day: int) -> datetime:
    return datetime(2026, 10, day, 12, 0, tzinfo=UTC)


def test_list_is_empty_without_recipes(client: TestClient) -> None:
    response = client.get("/api/recipes")
    assert response.status_code == 200
    assert response.json() == []


def test_list_returns_summaries_newest_first(
    client: TestClient, session: Session
) -> None:
    old = add_recipe(session, title="ישן", created_at=at(1))
    new = add_recipe(session, title="חדש", created_at=at(3))
    mid = add_recipe(session, title="אמצעי", created_at=at(2))
    ids = [item["id"] for item in client.get("/api/recipes").json()]
    assert ids == [str(new.id), str(mid.id), str(old.id)]


def test_list_breaks_ties_by_id(client: TestClient, session: Session) -> None:
    recipes = [
        add_recipe(session, title=f"מתכון {n}", created_at=at(1)) for n in range(4)
    ]
    ids = [item["id"] for item in client.get("/api/recipes").json()]
    # SQLite stores UUIDs as 32 hex characters, so that is the order it sorts by.
    assert ids == [str(r.id) for r in sorted(recipes, key=lambda r: r.id.hex)]


def test_summary_shape(client: TestClient, session: Session) -> None:
    party = add_tag(session, "מסיבות")
    grill = add_tag(session, "על האש")
    recipe = add_recipe(
        session,
        title="שקשוקה",
        tags=[grill, party],
        prep_time_minutes=10,
        cook_time_minutes=20,
        created_at=at(5),
    )
    [summary] = client.get("/api/recipes").json()
    assert set(summary) == {
        "id",
        "title",
        "tags",
        "total_minutes",
        "photo",
        "created_at",
    }
    assert summary["id"] == str(recipe.id)
    assert summary["tags"][0].keys() == {"id", "name"}
    assert [tag["name"] for tag in summary["tags"]] == ["מסיבות", "על האש"]
    assert summary["total_minutes"] == 30
    assert summary["photo"] is None
    assert summary["created_at"] == "2026-10-05T12:00:00Z"


@pytest.mark.parametrize(
    ("prep", "cook", "expected"),
    [(None, None, None), (10, None, 10), (None, 25, 25), (10, 25, 35), (0, 0, 0)],
)
def test_total_minutes(
    prep: int | None, cook: int | None, expected: int | None
) -> None:
    assert total_minutes(prep, cook) == expected


def test_recipe_without_tags_has_an_empty_list(
    client: TestClient, session: Session
) -> None:
    recipe = add_recipe(session)
    [summary] = client.get("/api/recipes").json()
    assert summary["tags"] == []
    assert client.get(f"/api/recipes/{recipe.id}").json()["tags"] == []


def test_tags_are_ordered_by_sort_order_then_name(
    client: TestClient, session: Session
) -> None:
    dessert = seeded_tag(session, "קינוח")
    morning = seeded_tag(session, "בוקר")
    zebra = add_tag(session, "זברה")
    apple = add_tag(session, "תפוח")
    recipe = add_recipe(session, tags=[apple, dessert, zebra, morning])
    names = ["בוקר", "קינוח", "זברה", "תפוח"]
    [summary] = client.get("/api/recipes").json()
    assert [tag["name"] for tag in summary["tags"]] == names
    body = client.get(f"/api/recipes/{recipe.id}").json()
    assert [tag["name"] for tag in body["tags"]] == names


def test_detail_returns_the_full_recipe(client: TestClient, session: Session) -> None:
    party = add_tag(session, "מסיבות")
    recipe = add_recipe(
        session,
        title="שקשוקה",
        description="ארוחת בוקר קלאסית",
        notes="אפשר להוסיף פטה.\nלהגיש חם.",
        tags=[party],
        base_servings=4,
        prep_time_minutes=10,
        cook_time_minutes=20,
        source_url="https://example.com/shakshuka",
        created_at=at(5),
        updated_at=at(6),
        ingredients=[
            ingredient(1, "שמן", amount=Decimal("1.5"), unit=Unit.TBSP, note="זית"),
            ingredient(0, "עגבניות", amount=Decimal("0.333"), unit=Unit.UNIT),
        ],
        steps=[step(1, "לבשל"), step(0, "לחתוך")],
    )
    body = client.get(f"/api/recipes/{recipe.id}").json()
    assert body["id"] == str(recipe.id)
    assert body["title"] == "שקשוקה"
    assert body["description"] == "ארוחת בוקר קלאסית"
    assert body["notes"] == "אפשר להוסיף פטה.\nלהגיש חם."
    assert [tag["name"] for tag in body["tags"]] == ["מסיבות"]
    assert body["base_servings"] == 4
    assert (body["prep_time_minutes"], body["cook_time_minutes"]) == (10, 20)
    assert body["source_url"] == "https://example.com/shakshuka"
    assert body["photo"] is None
    assert body["created_at"] == "2026-10-05T12:00:00Z"
    assert body["updated_at"] == "2026-10-06T12:00:00Z"
    assert [item["name"] for item in body["ingredients"]] == ["עגבניות", "שמן"]
    assert [item["description"] for item in body["steps"]] == ["לחתוך", "לבשל"]


def test_description_and_notes_are_null_when_absent(
    client: TestClient, session: Session
) -> None:
    recipe = add_recipe(session)
    body = client.get(f"/api/recipes/{recipe.id}").json()
    assert body["description"] is None
    assert body["notes"] is None
    assert body["ingredients"] == []
    assert body["steps"] == []


def test_amounts_are_json_numbers_and_to_taste_is_null(
    client: TestClient, session: Session
) -> None:
    recipe = add_recipe(
        session,
        ingredients=[
            ingredient(0, "קמח", amount=Decimal("1.5"), unit=Unit.CUP),
            ingredient(1, "שום", amount=Decimal("0.333"), unit=Unit.CLOVE),
            ingredient(2, "מלח"),
        ],
    )
    response = client.get(f"/api/recipes/{recipe.id}")
    assert '"amount":1.5' in response.text
    assert '"amount":0.333' in response.text
    flour, garlic, salt = response.json()["ingredients"]
    assert (flour["amount"], flour["unit"]) == (1.5, "cup")
    assert (garlic["amount"], garlic["unit"]) == (0.333, "clove")
    assert (salt["amount"], salt["unit"]) == (None, None)
    assert flour.keys() == {
        "id",
        "name",
        "amount",
        "unit",
        "note",
        "original",
        "source",
    }


def test_original_is_null_unless_the_ingredient_was_edited(
    client: TestClient, session: Session
) -> None:
    recipe = add_recipe(
        session,
        ingredients=[
            ingredient(
                0,
                "קימל",
                amount=Decimal("2"),
                unit=Unit.TSP,
                has_original=True,
                original_amount=Decimal("1"),
                original_unit=Unit.TSP,
            ),
            ingredient(
                1, "פלפל", amount=Decimal("1"), unit=Unit.TSP, has_original=True
            ),
            ingredient(2, "מלח", amount=Decimal("1"), unit=Unit.TSP),
        ],
    )
    cumin, pepper, salt = client.get(f"/api/recipes/{recipe.id}").json()["ingredients"]
    assert cumin["original"] == {"amount": 1.0, "unit": "tsp"}
    # Originally "to taste": an original exists, and both of its parts are null.
    assert pepper["original"] == {"amount": None, "unit": None}
    assert salt["original"] is None


def test_source_and_source_text_come_from_an_import(
    client: TestClient, session: Session
) -> None:
    recipe = add_recipe(
        session,
        ingredients=[
            ingredient(
                0,
                "חמאה",
                amount=Decimal("227"),
                unit=Unit.G,
                source_amount=Decimal("8"),
                source_unit=SourceUnit.OZ,
            ),
            ingredient(
                1,
                "חלב",
                amount=Decimal("240"),
                unit=Unit.ML,
                source_amount=Decimal("8.5"),
                source_unit=SourceUnit.FL_OZ,
            ),
            ingredient(2, "סוכר", amount=Decimal("100"), unit=Unit.G),
        ],
        steps=[
            step(0, "לחמם ל-180 מעלות", source_text="Preheat to 350°F"),
            step(1, "לאפות"),
        ],
    )
    body = client.get(f"/api/recipes/{recipe.id}").json()
    butter, milk, sugar = body["ingredients"]
    assert butter["source"] == {"amount": 8.0, "unit": "oz"}
    assert milk["source"] == {"amount": 8.5, "unit": "fl_oz"}
    assert sugar["source"] is None
    assert butter["original"] is None
    assert [item["source_text"] for item in body["steps"]] == [
        "Preheat to 350°F",
        None,
    ]


def test_description_and_notes_may_be_at_their_limits(
    client: TestClient, session: Session
) -> None:
    recipe = add_recipe(session, description="א" * 500, notes="ב" * 5000)
    body = client.get(f"/api/recipes/{recipe.id}").json()
    assert (len(body["description"]), len(body["notes"])) == (500, 5000)


def test_unknown_recipe_is_404_with_a_code(client: TestClient) -> None:
    response = client.get(f"/api/recipes/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Recipe not found", "code": "recipe_not_found"}


def test_malformed_id_is_a_422(client: TestClient) -> None:
    assert client.get("/api/recipes/not-a-uuid").status_code == 422


def test_detail_does_not_mix_in_other_recipes_children(
    client: TestClient, session: Session
) -> None:
    add_recipe(
        session,
        title="אחר",
        ingredients=[ingredient(0, "סוכר")],
        steps=[step(0, "x")],
    )
    mine = add_recipe(session, ingredients=[ingredient(0, "קמח")], steps=[step(0, "y")])
    body = client.get(f"/api/recipes/{mine.id}").json()
    assert [i["name"] for i in body["ingredients"]] == ["קמח"]
    assert [s["description"] for s in body["steps"]] == ["y"]
