"""Deterministic conversions for imported drafts (FR-21).

These live in code, not in the model's output: the model only reports what the
source says (`source`), and this module turns it into metric. Cups and spoons are
left alone.
"""

import math
import re

from app.core.units import SourceUnit, Unit
from app.imports.schemas import DraftIngredient, DraftStep

_GRAMS_PER_OZ = 28.349523125
_GRAMS_PER_LB = 453.59237
_ML_PER_FL_OZ = 29.5735295625

_FACTORS: dict[SourceUnit, tuple[float, Unit]] = {
    SourceUnit.OZ: (_GRAMS_PER_OZ, Unit.G),
    SourceUnit.LB: (_GRAMS_PER_LB, Unit.G),
    SourceUnit.FL_OZ: (_ML_PER_FL_OZ, Unit.ML),
}


def friendly_round(value: float) -> float:
    """Round a converted metric amount (Adi's rule, Story 5.2).

    From 10 up, to the nearest 5 (half rounds up). Below 10, to the nearest 0.1 and
    never below 0.1, so a pinch of yeast stays 0.6 g instead of becoming 1 g or 0.
    """
    if value >= 10:
        return float(math.floor(value / 5 + 0.5) * 5)
    return max(0.1, math.floor(value * 10 + 0.5) / 10)


def convert_ingredient(ingredient: DraftIngredient) -> DraftIngredient:
    """Fill amount and unit from `source` (oz, lb, fl oz); keep `source` too."""
    if ingredient.source is None:
        return ingredient
    factor, unit = _FACTORS[ingredient.source.unit]
    return ingredient.model_copy(
        update={
            "amount": friendly_round(ingredient.source.amount * factor),
            "unit": unit,
        }
    )


# 350°F, 350 °F, 350ºF, 350-375°F, 350 degrees F, 350 מעלות פרנהייט, 350° פרנהייט.
_FAHRENHEIT = re.compile(
    r"(?P<low>\d{2,3})"
    r"(?:\s*[-–]\s*(?P<high>\d{2,3}))?"
    r"\s*(?:°|º|˚|מעלות|degrees?)\s*(?:F\b|Fahrenheit\b|פרנהייט)",
    re.IGNORECASE,
)


def _to_celsius(fahrenheit: int) -> int:
    """°C rounded to the nearest 5 (half rounds up): 350°F is 176.7°C, so 175°C."""
    celsius = (fahrenheit - 32) * 5 / 9
    return int(math.floor(celsius / 5 + 0.5) * 5)


def fahrenheit_to_celsius(text: str) -> str:
    """Rewrite every °F temperature in a step as °C (rounding: see `_to_celsius`)."""

    def replace(match: re.Match[str]) -> str:
        low = _to_celsius(int(match["low"]))
        if match["high"] is None:
            return f"{low}°C"
        return f"{low}-{_to_celsius(int(match['high']))}°C"

    return _FAHRENHEIT.sub(replace, text)


def convert_step(step: DraftStep) -> DraftStep:
    """Convert °F in a step, keeping the unconverted text as `source_text`."""
    converted = fahrenheit_to_celsius(step.description)
    if converted == step.description:
        return step
    return step.model_copy(
        update={"description": converted, "source_text": step.description}
    )
