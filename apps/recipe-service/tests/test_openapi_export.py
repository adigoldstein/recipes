import json
from pathlib import Path

import pytest

from app.openapi_export import export_openapi, main


def test_export_writes_stable_sorted_json(tmp_path: Path) -> None:
    first = tmp_path / "nested" / "openapi.json"
    second = tmp_path / "again.json"
    export_openapi(first)
    export_openapi(second)

    text = first.read_text(encoding="utf-8")
    assert text == second.read_text(encoding="utf-8")
    assert text.endswith("}\n")
    assert "\r" not in text
    spec = json.loads(text)
    assert spec["paths"]["/api/recipes"]["get"]["operationId"] == "recipes_list_recipes"
    assert spec["components"]["schemas"]["ErrorCode"]["enum"] == ["recipe_not_found"]


def test_main_requires_exactly_one_path(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["prog"]) == 2
    assert "usage" in capsys.readouterr().err
