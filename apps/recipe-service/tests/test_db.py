import json
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import StatementError
from sqlmodel import Session

from app.core.units import Unit
from app.recipes.models import IngredientItem, Recipe
from tests.factories import add_recipe, ingredient, step


def test_every_connection_enforces_foreign_keys(session: Session) -> None:
    assert session.exec(text("PRAGMA foreign_keys")).scalar_one() == 1  # type: ignore[call-overload]


def test_every_connection_waits_five_seconds_for_a_lock(session: Session) -> None:
    """Written out, not a driver default (AD-43)."""
    assert session.exec(text("PRAGMA busy_timeout")).scalar() == 5000  # type: ignore[call-overload]


def test_every_connection_uses_wal(session: Session) -> None:
    assert session.exec(text("PRAGMA journal_mode")).scalar_one() == "wal"  # type: ignore[call-overload]


def test_timestamps_round_trip_as_utc(session: Session) -> None:
    stamp = datetime(2026, 10, 26, 21, 30, tzinfo=timezone(timedelta(hours=3)))
    recipe = add_recipe(session, created_at=stamp)
    session.expire_all()
    assert session.get_one(Recipe, recipe.id).created_at == datetime(
        2026, 10, 26, 18, 30, tzinfo=UTC
    )
    assert recipe.created_at.tzinfo is UTC


def test_naive_timestamps_are_rejected(session: Session) -> None:
    session.add(Recipe(title="x", base_servings=1, created_at=datetime(2026, 1, 1)))
    with pytest.raises(Exception, match="Naive datetimes"):
        session.commit()


def test_amounts_are_quantized_to_three_decimals(session: Session) -> None:
    recipe = add_recipe(
        session,
        ingredients=[
            ingredient("קמח", amount=Decimal("0.3333333")),
            ingredient("סוכר", amount=Decimal("1.5")),
            ingredient("מלח"),
        ],
    )
    session.expire_all()
    amounts = [item.amount for item in session.get_one(Recipe, recipe.id).ingredients]
    assert amounts == [Decimal("0.333"), Decimal("1.500"), None]


def _raw_json(session: Session, recipe: Recipe, column: str) -> str:
    row = session.exec(  # type: ignore[call-overload]
        text(f"SELECT {column} FROM recipe WHERE id = :id").bindparams(id=recipe.id.hex)
    )
    return str(row.scalar_one())


def test_amounts_are_stored_as_strings_with_three_decimals(session: Session) -> None:
    recipe = add_recipe(
        session,
        ingredients=[
            ingredient("קמח", amount=Decimal("0.3333333")),
            ingredient("מלח"),
        ],
    )
    stored = json.loads(_raw_json(session, recipe, "ingredients"))
    assert [item["amount"] for item in stored] == ["0.333", None]


def test_stored_json_keeps_hebrew_readable(session: Session) -> None:
    recipe = add_recipe(
        session, ingredients=[ingredient("קמח")], steps=[step("לערבב היטב")]
    )
    assert "קמח" in _raw_json(session, recipe, "ingredients")
    assert "לערבב היטב" in _raw_json(session, recipe, "steps")


def test_an_unknown_unit_in_the_stored_json_fails_when_read(session: Session) -> None:
    recipe = add_recipe(session, ingredients=[ingredient("קמח", unit=Unit.G)])
    session.exec(  # type: ignore[call-overload]
        text(
            "UPDATE recipe "
            "SET ingredients = json_set(ingredients, '$[0].unit', 'bogus')"
        )
    )
    session.commit()
    session.expire_all()
    with pytest.raises(ValidationError, match="unit"):
        session.get_one(Recipe, recipe.id)


def test_an_invalid_item_is_rejected_on_write(session: Session) -> None:
    bad = IngredientItem.model_construct(name="קמח", unit="bogus")  # type: ignore[arg-type]
    session.add(Recipe(title="x", base_servings=1, ingredients=[bad]))
    # SQLAlchemy wraps what a type raises while binding a parameter.
    with pytest.raises(StatementError, match="Input should be"):
        session.commit()


def test_a_new_list_is_saved_and_the_old_items_are_untouched(session: Session) -> None:
    recipe = add_recipe(session, ingredients=[ingredient("קמח", amount=Decimal(1))])
    first = recipe.ingredients[0]
    recipe.ingredients = [first.model_copy(update={"amount": Decimal(2)})]
    session.commit()
    session.expire_all()
    saved = session.get_one(Recipe, recipe.id).ingredients
    assert [(item.id, item.amount) for item in saved] == [(first.id, Decimal("2.000"))]
    assert first.amount == Decimal(1)


def test_items_cannot_be_edited_in_place() -> None:
    item = ingredient("קמח")
    with pytest.raises(ValidationError, match="frozen"):
        item.name = "סוכר"  # type: ignore[misc]
