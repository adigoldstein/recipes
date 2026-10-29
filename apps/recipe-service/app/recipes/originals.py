"""The FR-7..9 original-value rule for one ingredient (AD-4, AD-20, AD-31).

Pure and database-free so the whole truth table can be unit tested. Every comparison
uses amounts quantized to 3 decimals; "to taste" is an amount of None, with no unit.
"""

from decimal import Decimal

from app.core.db import AMOUNT_QUANTUM
from app.recipes.models import Ingredient
from app.recipes.units import Unit

Quantity = tuple[Decimal | None, Unit | None]


def quantity(amount: Decimal | None, unit: Unit | None) -> Quantity:
    """The comparable form of an amount and unit; to taste has no unit."""
    if amount is None:
        return (None, None)
    return (amount.quantize(AMOUNT_QUANTUM), unit)


def apply_edit(
    ingredient: Ingredient, amount: Decimal | None, unit: Unit | None
) -> None:
    """Set the ingredient's amount and unit, keeping its original up to date.

    - The first change stores the previous value as the original; later changes keep it.
    - Changing to or from to taste counts as a change.
    - Setting the value back to the original clears the original (a reset).
    - A write that changes nothing leaves the original alone.
    """
    current = quantity(ingredient.amount, ingredient.unit)
    new = quantity(amount, unit)
    if new != current:
        if not ingredient.has_original:
            ingredient.has_original = True
            ingredient.original_amount, ingredient.original_unit = current
        ingredient.amount, ingredient.unit = new
    if ingredient.has_original and new == quantity(
        ingredient.original_amount, ingredient.original_unit
    ):
        ingredient.has_original = False
        ingredient.original_amount = None
        ingredient.original_unit = None
