"""The FR-7..9 original-value rule for one ingredient (AD-4, AD-20, AD-31).

Pure and database-free so the whole truth table can be unit tested. Every comparison
uses amounts quantized to 3 decimals; "to taste" is an amount of None, with no unit.
"""

from decimal import Decimal

from app.core.db import AMOUNT_QUANTUM
from app.core.units import Unit
from app.recipes.models import IngredientItem, OriginalItem

Quantity = tuple[Decimal | None, Unit | None]


def quantity(amount: Decimal | None, unit: Unit | None) -> Quantity:
    """The comparable form of an amount and unit; to taste has no unit."""
    if amount is None:
        return (None, None)
    return (amount.quantize(AMOUNT_QUANTUM), unit)


def apply_edit(
    item: IngredientItem, amount: Decimal | None, unit: Unit | None
) -> IngredientItem:
    """The ingredient with a new amount and unit, its original kept up to date.

    Items are immutable (AD-41), so this returns a new item and leaves `item` alone.

    - The first change stores the previous value as the original; later changes keep it.
    - Changing to or from to taste counts as a change.
    - Setting the value back to the original clears the original (a reset).
    - A write that changes nothing leaves the original alone.
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
