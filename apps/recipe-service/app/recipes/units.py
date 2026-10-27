"""Ingredient unit codes, defined once (AD-20). Hebrew labels live in `he.json`."""

from enum import StrEnum


class Unit(StrEnum):
    G = "g"
    KG = "kg"
    ML = "ml"
    L = "l"
    TSP = "tsp"
    TBSP = "tbsp"
    CUP = "cup"
    UNIT = "unit"
    PINCH = "pinch"
    CLOVE = "clove"
    SLICE = "slice"
    CAN = "can"
    PACKAGE = "package"


class SourceUnit(StrEnum):
    """Imperial units an import converted to metric; kept as the 'source' value."""

    OZ = "oz"
    LB = "lb"
    FL_OZ = "fl_oz"


# Counted things the scaler rounds to the nearest half (AD-20, AD-32).
COUNTABLE_UNITS = frozenset({Unit.UNIT, Unit.CLOVE, Unit.SLICE, Unit.CAN, Unit.PACKAGE})
