"""The ingredient unit codes, defined in one place (AD-20). The Hebrew names are in
`he.json`."""

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
    """Imperial units that an import converted to metric. We keep the original unit
    as the 'source' value."""

    OZ = "oz"
    LB = "lb"
    FL_OZ = "fl_oz"


# Units of things you count. When servings change, these amounts are rounded to
# the nearest half (AD-20, AD-32).
COUNTABLE_UNITS = frozenset({Unit.UNIT, Unit.CLOVE, Unit.SLICE, Unit.CAN, Unit.PACKAGE})
