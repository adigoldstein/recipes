"""Keeps an ingredient's original value when it is edited (FR-7..9, AD-4, AD-20, AD-31).

This code does not use the database, so every case can be unit tested. Amounts are
compared after rounding to 3 decimals. "To taste" is an amount of None with no unit.
"""

from decimal import Decimal

from app.core.db import AMOUNT_QUANTUM
from app.core.units import Unit
from app.recipes.models import IngredientItem, OriginalItem

Quantity = tuple[Decimal | None, Unit | None]


def quantity(amount: Decimal | None, unit: Unit | None) -> Quantity:
    """Returns the amount and unit in a form we can compare. "To taste" has no unit."""
    if amount is None:
        return (None, None)
    return (amount.quantize(AMOUNT_QUANTUM), unit)


def apply_edit(
    item: IngredientItem, amount: Decimal | None, unit: Unit | None
) -> IngredientItem:
    """Returns the ingredient with a new amount and unit, and updates its original.

    Items cannot be changed (AD-41), so this returns a new item and does not change
    `item`.

    - The first change saves the previous value as the original. Later changes keep it.
    - Changing to or from "to taste" counts as a change.
    - Setting the value back to the original deletes the original (a reset).
    - Saving the same value does not touch the original.
    """
    current = quantity(item.amount, item.unit)
    new = quantity(amount, unit)
    original = item.original
    if new != current:
        if original is None:
            original = OriginalItem(amount=current[0], unit=current[1])
        item = item.model_copy(update={"amount": new[0], "unit": new[1]})
    if original is not None and new == quantity(original.amount, original.unit):
        original = None
    return item.model_copy(update={"original": original})
