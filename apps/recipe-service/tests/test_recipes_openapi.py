from typing import Any

import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.recipes.schemas import DESCRIPTION_MAX_LENGTH, NOTES_MAX_LENGTH, RecipeRead
from app.recipes.units import COUNTABLE_UNITS, SourceUnit, Unit


@pytest.fixture
def spec(app: FastAPI) -> dict[str, Any]:
    return app.openapi()


def test_recipe_operation_ids(spec: dict[str, Any]) -> None:
    paths = spec["paths"]
    assert paths["/api/recipes"]["get"]["operationId"] == "recipes_list_recipes"
    assert (
        paths["/api/recipes/{recipe_id}"]["get"]["operationId"] == "recipes_get_recipe"
    )


def test_unit_enums_are_published(spec: dict[str, Any]) -> None:
    schemas = spec["components"]["schemas"]
    assert schemas["Unit"]["enum"] == [unit.value for unit in Unit]
    assert schemas["SourceUnit"]["enum"] == ["oz", "lb", "fl_oz"]


def test_countable_units_are_defined_beside_the_enum() -> None:
    assert {unit.value for unit in COUNTABLE_UNITS} == {
        "unit",
        "clove",
        "slice",
        "can",
        "package",
    }
    assert SourceUnit.OZ.value == "oz"


def test_not_found_response_publishes_the_error_codes(spec: dict[str, Any]) -> None:
    detail = spec["paths"]["/api/recipes/{recipe_id}"]["get"]["responses"]["404"]
    assert detail["content"]["application/json"]["schema"]["$ref"].endswith(
        "/ErrorResponse"
    )
    assert "recipe_not_found" in spec["components"]["schemas"]["ErrorCode"]["enum"]


def test_amounts_are_numbers_in_the_contract(spec: dict[str, Any]) -> None:
    schemas = spec["components"]["schemas"]
    assert {"type": "number"} in schemas["IngredientRead"]["properties"]["amount"][
        "anyOf"
    ]
    assert schemas["SourceValue"]["properties"]["amount"]["type"] == "number"


def test_text_limits_are_in_the_contract(spec: dict[str, Any]) -> None:
    properties = spec["components"]["schemas"]["RecipeRead"]["properties"]
    for name, limit in (("description", 500), ("notes", 5000)):
        assert {"type": "string", "maxLength": limit} in properties[name]["anyOf"]


@pytest.mark.parametrize(
    ("field", "limit"),
    [("description", DESCRIPTION_MAX_LENGTH), ("notes", NOTES_MAX_LENGTH)],
)
def test_text_limits_are_enforced_by_the_schema(field: str, limit: int) -> None:
    data: dict[str, Any] = {
        "id": "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b",
        "title": "x",
        "description": None,
        "notes": None,
        "tags": [],
        "base_servings": 1,
        "prep_time_minutes": None,
        "cook_time_minutes": None,
        "source_url": None,
        "photo": None,
        "ingredients": [],
        "steps": [],
        "created_at": "2026-10-26T12:00:00Z",
        "updated_at": "2026-10-26T12:00:00Z",
    }
    RecipeRead.model_validate({**data, field: "x" * limit})
    with pytest.raises(ValidationError):
        RecipeRead.model_validate({**data, field: "x" * (limit + 1)})
