import pytest

from app.core.units import SourceUnit, Unit
from app.imports.conversion import (
    convert_ingredient,
    convert_step,
    fahrenheit_to_celsius,
    friendly_round,
)
from app.imports.schemas import DraftIngredient, DraftSource, DraftStep


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0.567, 0.6),
        (0.2, 0.2),
        (0.04, 0.1),
        (7.09, 7.1),
        (9.96, 10),
        (10, 10),
        (12.4, 10),
        (12.5, 15),
        (42.5, 45),
        (227, 225),
        (340, 340),
        (454, 455),
        (907, 905),
        (1361, 1360),
    ],
)
def test_friendly_round(value: float, expected: float) -> None:
    assert friendly_round(value) == expected


@pytest.mark.parametrize(
    ("amount", "source_unit", "grams_or_ml", "unit"),
    [
        (8, SourceUnit.OZ, 225, Unit.G),
        (1, SourceUnit.LB, 455, Unit.G),
        (2, SourceUnit.LB, 905, Unit.G),
        (8, SourceUnit.FL_OZ, 235, Unit.ML),
        (0.02, SourceUnit.OZ, 0.6, Unit.G),  # a little yeast keeps its decimal
    ],
)
def test_imperial_units_become_metric_and_keep_the_source(
    amount: float, source_unit: SourceUnit, grams_or_ml: float, unit: Unit
) -> None:
    ingredient = DraftIngredient(
        name="x", source=DraftSource(amount=amount, unit=source_unit)
    )
    converted = convert_ingredient(ingredient)
    assert converted.amount == grams_or_ml
    assert converted.unit is unit
    assert converted.source == ingredient.source


def test_the_code_overwrites_a_conversion_the_model_did_itself() -> None:
    ingredient = DraftIngredient(
        name="x",
        amount=1,
        unit=Unit.KG,
        source=DraftSource(amount=8, unit=SourceUnit.OZ),
    )
    converted = convert_ingredient(ingredient)
    assert (converted.amount, converted.unit) == (225, Unit.G)


def test_cups_and_spoons_are_left_alone() -> None:
    ingredient = DraftIngredient(name="x", amount=2, unit=Unit.CUP)
    assert convert_ingredient(ingredient) == ingredient


def test_an_ingredient_without_a_source_is_unchanged() -> None:
    ingredient = DraftIngredient(name="מלח")
    assert convert_ingredient(ingredient) == ingredient


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("מחממים תנור ל-350°F", "מחממים תנור ל-175°C"),
        ("אופים ב-350 °F", "אופים ב-175°C"),
        ("אופים ב-375ºF כ-20 דקות", "אופים ב-190°C כ-20 דקות"),
        ("אופים ב-350-375°F", "אופים ב-175-190°C"),
        ("Bake at 400 degrees F", "Bake at 205°C"),
        ("אופים ב-425 מעלות פרנהייט", "אופים ב-220°C"),
        ("מבשלים עד 165°F בפנים", "מבשלים עד 75°C בפנים"),
        ("מחממים ל-140°F", "מחממים ל-60°C"),
        ("מחממים ל-200°C", "מחממים ל-200°C"),
        ("אופים 20 דקות", "אופים 20 דקות"),
    ],
)
def test_fahrenheit_is_rewritten_to_celsius(text: str, expected: str) -> None:
    assert fahrenheit_to_celsius(text) == expected


def test_a_converted_step_keeps_its_original_text() -> None:
    step = convert_step(DraftStep(description="אופים ב-350°F"))
    assert step.description == "אופים ב-175°C"
    assert step.source_text == "אופים ב-350°F"


def test_an_unchanged_step_has_no_source_text() -> None:
    step = convert_step(DraftStep(description="מערבבים"))
    assert step.source_text is None
