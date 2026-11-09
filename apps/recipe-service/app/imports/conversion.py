"""Converts units and temperatures in imported drafts to metric (FR-21).

The conversion is done here in code, not by the AI model. The model only reports what
the source says (`source`), and this module converts it to metric. Cups and spoons
are not converted.
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
    """Rounds a converted metric amount to a friendly number (Adi's rule, Story 5.2)."""
    # From 10 and up: round to the nearest 5 (a half rounds up).
    if value >= 10:
        return float(math.floor(value / 5 + 0.5) * 5)
    # Below 10: round to the nearest 0.1, but never below 0.1. So a little yeast
    # stays 0.6 g instead of becoming 1 g or 0.
    return max(0.1, math.floor(value * 10 + 0.5) / 10)


def convert_ingredient(ingredient: DraftIngredient) -> DraftIngredient:
    """Fills the metric amount and unit from `source` (oz, lb, fl oz), and keeps
    `source` too."""
    if ingredient.source is None:
        return ingredient
    factor, unit = _FACTORS[ingredient.source.unit]
    return ingredient.model_copy(
        update={
            "amount": friendly_round(ingredient.source.amount * factor),
            "unit": unit,
        }
    )


# Finds Fahrenheit temperatures written in any of these ways:
# 350°F, 350 °F, 350ºF, 350-375°F, 350 degrees F, 350 מעלות פרנהייט, 350° פרנהייט.
_FAHRENHEIT = re.compile(
    r"(?P<low>\d{2,3})"
    r"(?:\s*[-–]\s*(?P<high>\d{2,3}))?"
    r"\s*(?:°|º|˚|מעלות|degrees?)\s*(?:F\b|Fahrenheit\b|פרנהייט)",
    re.IGNORECASE,
)


def _to_celsius(fahrenheit: int) -> int:
    """Converts °F to °C, rounded to the nearest 5 (a half rounds up).

    For example, 350°F is 176.7°C, which becomes 175°C.
    """
    celsius = (fahrenheit - 32) * 5 / 9
    return int(math.floor(celsius / 5 + 0.5) * 5)


def fahrenheit_to_celsius(text: str) -> str:
    """Replaces every °F temperature in the text with °C (rounded, see
    `_to_celsius`)."""

    def replace(match: re.Match[str]) -> str:
        low = _to_celsius(int(match["low"]))
        if match["high"] is None:
            return f"{low}°C"
        return f"{low}-{_to_celsius(int(match['high']))}°C"

    return _FAHRENHEIT.sub(replace, text)


def convert_step(step: DraftStep) -> DraftStep:
    """Converts °F in a step to °C, and keeps the text before conversion in
    `source_text`."""
    converted = fahrenheit_to_celsius(step.description)
    if converted == step.description:
        return step
    return step.model_copy(
        update={"description": converted, "source_text": step.description}
    )
