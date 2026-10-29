"""The FR-7..9 original-value truth table (AD-4, AD-20, AD-31)."""

import uuid
from decimal import Decimal

import pytest

from app.recipes.models import Ingredient
from app.recipes.originals import apply_edit, quantity
from app.recipes.units import Unit

D = Decimal
Value = tuple[Decimal | None, Unit | None]
TASTE: Value = (None, None)
ONE_TSP: Value = (D("1"), Unit.TSP)
TWO_TSP: Value = (D("2"), Unit.TSP)
THREE_TSP: Value = (D("3"), Unit.TSP)
ONE_TBSP: Value = (D("1"), Unit.TBSP)
TWO_TBSP: Value = (D("2"), Unit.TBSP)


def make(current: Value, original: Value | None = None) -> Ingredient:
    ingredient = Ingredient(
        recipe_id=uuid.uuid4(),
        position=0,
        name="כמון",
        amount=current[0],
        unit=current[1],
    )
    if original is not None:
        ingredient.has_original = True
        ingredient.original_amount, ingredient.original_unit = original
    return ingredient


def state(ingredient: Ingredient) -> tuple[Value, Value | None]:
    original = (
        (ingredient.original_amount, ingredient.original_unit)
        if ingredient.has_original
        else None
    )
    return (ingredient.amount, ingredient.unit), original


@pytest.mark.parametrize(
    ("current", "original", "new", "expected_current", "expected_original"),
    [
        # No original yet.
        (ONE_TSP, None, ONE_TSP, ONE_TSP, None),  # nothing changed
        (ONE_TSP, None, TWO_TSP, TWO_TSP, ONE_TSP),  # amount changed
        (ONE_TSP, None, ONE_TBSP, ONE_TBSP, ONE_TSP),  # unit changed
        (ONE_TSP, None, TASTE, TASTE, ONE_TSP),  # to taste counts
        (TASTE, None, TWO_TSP, TWO_TSP, TASTE),  # from to taste counts
        (TASTE, None, TASTE, TASTE, None),  # to taste stays to taste
        # The first original is kept.
        (TWO_TSP, ONE_TSP, THREE_TSP, THREE_TSP, ONE_TSP),  # 1 -> 2 -> 3 keeps 1
        (TWO_TSP, ONE_TSP, TWO_TSP, TWO_TSP, ONE_TSP),  # untouched
        (TWO_TSP, ONE_TSP, TWO_TBSP, TWO_TBSP, ONE_TSP),
        (TWO_TSP, TASTE, THREE_TSP, THREE_TSP, TASTE),  # originally to taste
        # Back to the original clears it.
        (TWO_TSP, ONE_TSP, ONE_TSP, ONE_TSP, None),
        (TWO_TSP, TASTE, TASTE, TASTE, None),
        (TASTE, ONE_TSP, ONE_TSP, ONE_TSP, None),
    ],
)
def test_original_truth_table(
    current: Value,
    original: Value | None,
    new: Value,
    expected_current: Value,
    expected_original: Value | None,
) -> None:
    ingredient = make(current, original)
    apply_edit(ingredient, *new)
    assert state(ingredient) == (expected_current, expected_original)


def test_thirds_compare_after_quantizing() -> None:
    ingredient = make((D("1"), Unit.CUP))
    apply_edit(ingredient, D("0.33333"), Unit.CUP)
    assert state(ingredient) == ((D("0.333"), Unit.CUP), (D("1"), Unit.CUP))
    # Typing the same third again (0.333) is no change, so the original stays.
    apply_edit(ingredient, D("0.333"), Unit.CUP)
    assert state(ingredient)[1] == (D("1"), Unit.CUP)
    apply_edit(ingredient, D("1.0000"), Unit.CUP)
    assert state(ingredient) == ((D("1"), Unit.CUP), None)


def test_quantity_normalizes_to_taste_and_rounds() -> None:
    assert quantity(None, Unit.CUP) == (None, None)
    assert quantity(D("0.33333"), None) == (D("0.333"), None)
