from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlmodel import Session

from app.recipes.models import Ingredient, Recipe
from tests.factories import add_recipe, ingredient


def test_every_connection_enforces_foreign_keys(session: Session) -> None:
    assert session.exec(text("PRAGMA foreign_keys")).scalar_one() == 1  # type: ignore[call-overload]


def test_every_connection_uses_wal(session: Session) -> None:
    assert session.exec(text("PRAGMA journal_mode")).scalar_one() == "wal"  # type: ignore[call-overload]


def test_child_row_with_unknown_recipe_is_rejected(session: Session) -> None:
    session.add(
        Ingredient(
            recipe_id=Recipe(title="x", base_servings=1).id, position=0, name="x"
        )
    )
    with pytest.raises(Exception, match="FOREIGN KEY"):
        session.commit()


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
            ingredient(0, "קמח", amount=Decimal("0.3333333")),
            ingredient(1, "סוכר", amount=Decimal("1.5")),
            ingredient(2, "מלח"),
        ],
    )
    session.expire_all()
    amounts = [item.amount for item in session.get_one(Recipe, recipe.id).ingredients]
    assert amounts == [Decimal("0.333"), Decimal("1.500"), None]
