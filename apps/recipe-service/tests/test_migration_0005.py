"""Migration 0005: ingredients and steps move inside the recipe as JSON (AD-41).

Each test moves the database back to 0004, adds real rows to the old tables, and then
upgrades it. The goal is to prove that no recipe, ingredient or step is ever lost.
"""

import json
import sqlite3
import uuid
from collections.abc import Iterator
from contextlib import closing
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Connection, inspect, text

from app.core.config import get_settings
from app.core.db import get_engine
from app.core.migrate import MIGRATIONS_DIR, migration_transaction

Stored = dict[str, list[dict[str, Any]]]


@pytest.fixture
def connection(client: TestClient) -> Iterator[Connection]:
    with get_engine(get_settings().data_dir).connect() as conn:
        yield conn


def _alembic_config(connection: Connection) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.attributes["connection"] = connection
    return config


def _backup_path() -> Any:
    return get_settings().data_dir / "app.db.bak-before-json"


def _legacy_row(connection: Connection, table: str, **values: Any) -> str:
    """Adds a row to an old table. Returns its id in the format used in the JSON."""
    row_id = uuid.uuid4()
    values = {"id": row_id.hex, **values}
    columns = ", ".join(values)
    marks = ", ".join(f":{name}" for name in values)
    connection.execute(
        text(f"INSERT INTO {table} ({columns}) VALUES ({marks})"), values
    )
    return str(row_id)


def _legacy_recipe(connection: Connection, title: str) -> uuid.UUID:
    recipe_id = uuid.uuid4()
    connection.execute(
        text(
            "INSERT INTO recipe (id, title, base_servings, created_at, updated_at) "
            "VALUES (:id, :title, 4, '2026-01-01', '2026-01-01')"
        ),
        {"id": recipe_id.hex, "title": title},
    )
    return recipe_id


def _json_item(id_: str, name: str, **fields: Any) -> dict[str, Any]:
    return {
        "id": id_,
        "name": name,
        "note": None,
        "amount": None,
        "unit": None,
        "original": None,
        "source": None,
        **fields,
    }


def _json_step(id_: str, description: str, source_text: str | None = None) -> Any:
    return {"id": id_, "description": description, "source_text": source_text}


def _legacy_recipes(connection: Connection) -> tuple[Config, dict[uuid.UUID, Stored]]:
    """Moves the database back to 0004 and adds two recipes to the old tables.

    Returns the JSON that each recipe should have at the end. The rows are added out
    of order and use every field: an original value, "originally to taste", an
    import source and a step's source text.
    """
    config = _alembic_config(connection)
    command.downgrade(config, "0004")
    connection.commit()

    cake = _legacy_recipe(connection, "עוגת שוקולד")

    def ingredient(position: int, name: str, **fields: Any) -> str:
        return _legacy_row(
            connection,
            "ingredient",
            recipe_id=cake.hex,
            position=position,
            name=name,
            **fields,
        )

    sugar = ingredient(
        1,
        "סוכר",
        amount=0.333,
        unit="cup",
        has_original=1,
        original_amount=1,
        original_unit="cup",
    )
    flour = ingredient(0, "קמח", amount=250, unit="g", note="מנופה")
    butter = ingredient(
        3, "חמאה", amount=227, unit="g", source_amount=8, source_unit="oz"
    )
    salt = ingredient(2, "מלח", amount=1, unit="tsp", has_original=1)
    bake = _legacy_row(
        connection, "step", recipe_id=cake.hex, position=1, description="לאפות"
    )
    heat = _legacy_row(
        connection,
        "step",
        recipe_id=cake.hex,
        position=0,
        description="לחמם ל-180 מעלות",
        source_text="Preheat to 350°F",
    )

    salad = _legacy_recipe(connection, "סלט")
    cucumber = _legacy_row(
        connection,
        "ingredient",
        recipe_id=salad.hex,
        position=0,
        name="מלפפון",
        note="קצוץ",
    )
    chop = _legacy_row(
        connection, "step", recipe_id=salad.hex, position=0, description="חותכים"
    )
    connection.commit()

    expected = {
        cake: {
            "ingredients": [
                _json_item(flour, "קמח", amount="250.000", unit="g", note="מנופה"),
                _json_item(
                    sugar,
                    "סוכר",
                    amount="0.333",
                    unit="cup",
                    original={"amount": "1.000", "unit": "cup"},
                ),
                _json_item(
                    salt,
                    "מלח",
                    amount="1.000",
                    unit="tsp",
                    original={"amount": None, "unit": None},
                ),
                _json_item(
                    butter,
                    "חמאה",
                    amount="227.000",
                    unit="g",
                    source={"amount": "8.000", "unit": "oz"},
                ),
            ],
            "steps": [
                _json_step(heat, "לחמם ל-180 מעלות", "Preheat to 350°F"),
                _json_step(bake, "לאפות"),
            ],
        },
        salad: {
            "ingredients": [_json_item(cucumber, "מלפפון", note="קצוץ")],
            "steps": [_json_step(chop, "חותכים")],
        },
    }
    return config, expected


def _stored(connection: Connection, recipe_id: uuid.UUID) -> Stored:
    row = connection.execute(
        text("SELECT ingredients, steps FROM recipe WHERE id = :id"),
        {"id": recipe_id.hex},
    ).one()
    return {"ingredients": json.loads(row.ingredients), "steps": json.loads(row.steps)}


def _old_tables(connection: Connection) -> dict[str, list[tuple[Any, ...]]]:
    return {
        table: [
            tuple(row)
            for row in connection.execute(text(f"SELECT * FROM {table} ORDER BY id"))
        ]
        for table in ("ingredient", "step")
    }


def _table_definitions(connection: Connection) -> list[tuple[str, str]]:
    rows = connection.execute(
        text(
            "SELECT name, sql FROM sqlite_master "
            "WHERE tbl_name IN ('ingredient', 'step') ORDER BY name"
        )
    )
    return [(row.name, row.sql) for row in rows]


def _upgrade(connection: Connection, config: Config) -> None:
    with migration_transaction(connection):
        command.upgrade(config, "head")


def test_upgrade_moves_every_row_into_the_recipe_json(connection: Connection) -> None:
    config, expected = _legacy_recipes(connection)
    _upgrade(connection, config)

    assert not {"ingredient", "step"} & set(inspect(connection).get_table_names())
    for recipe_id, json_items in expected.items():
        assert _stored(connection, recipe_id) == json_items


def test_the_app_reads_the_migrated_recipes(
    client: TestClient, connection: Connection
) -> None:
    config, expected = _legacy_recipes(connection)
    _upgrade(connection, config)

    cake_id = next(iter(expected))
    body = client.get(f"/api/recipes/{cake_id}").json()
    flour, sugar, salt, butter = body["ingredients"]
    assert (flour["name"], flour["amount"], flour["unit"]) == ("קמח", 250.0, "g")
    assert sugar["original"] == {"amount": 1.0, "unit": "cup"}
    assert salt["original"] == {"amount": None, "unit": None}
    assert butter["source"] == {"amount": 8.0, "unit": "oz"}
    assert [step["description"] for step in body["steps"]] == [
        "לחמם ל-180 מעלות",
        "לאפות",
    ]
    assert body["steps"][0]["source_text"] == "Preheat to 350°F"
    assert [item["id"] for item in body["ingredients"]] == [
        item["id"] for item in expected[cake_id]["ingredients"]
    ]


def test_downgrade_and_upgrade_again_give_back_the_same_data(
    connection: Connection,
) -> None:
    """Upgrade and downgrade: old tables -> JSON -> old tables -> JSON, and nothing
    is lost."""
    config, expected = _legacy_recipes(connection)
    old_rows = _old_tables(connection)
    old_definitions = _table_definitions(connection)
    assert sum(len(rows) for rows in old_rows.values()) == 8

    _upgrade(connection, config)
    with migration_transaction(connection):
        command.downgrade(config, "0004")

    assert _old_tables(connection) == old_rows
    assert _table_definitions(connection) == old_definitions
    columns = {c["name"] for c in inspect(connection).get_columns("recipe")}
    assert not {"ingredients", "steps"} & columns

    _upgrade(connection, config)
    for recipe_id, json_items in expected.items():
        assert _stored(connection, recipe_id) == json_items


def test_upgrade_backs_up_the_database_first(connection: Connection) -> None:
    config, _expected = _legacy_recipes(connection)
    assert not _backup_path().exists()

    _upgrade(connection, config)

    with closing(sqlite3.connect(_backup_path())) as saved:
        version = saved.execute("SELECT version_num FROM alembic_version")
        assert version.fetchall() == [("0004",)]
        assert saved.execute("SELECT count(*) FROM ingredient").fetchone() == (5,)
        assert saved.execute("SELECT count(*) FROM step").fetchone() == (3,)


def test_an_earlier_backup_is_never_overwritten(connection: Connection) -> None:
    config, _expected = _legacy_recipes(connection)
    _backup_path().write_bytes(b"older backup")

    _upgrade(connection, config)

    assert _backup_path().read_bytes() == b"older backup"


def test_an_empty_database_needs_no_backup(connection: Connection) -> None:
    config = _alembic_config(connection)
    command.downgrade(config, "0004")
    connection.commit()

    _upgrade(connection, config)

    assert not _backup_path().exists()


def test_a_recipe_without_steps_stops_the_migration_and_loses_nothing(
    connection: Connection,
) -> None:
    config, expected = _legacy_recipes(connection)
    broken = _legacy_recipe(connection, "בלי שלבים")
    _legacy_row(
        connection, "ingredient", recipe_id=broken.hex, position=0, name="ביצים"
    )
    connection.commit()
    old_rows = _old_tables(connection)

    with pytest.raises(RuntimeError, match="no ingredients or no steps"):
        _upgrade(connection, config)

    assert _old_tables(connection) == old_rows
    version = connection.execute(text("SELECT version_num FROM alembic_version"))
    assert version.scalar_one() == "0004"

    # Fix the data and run again. The first, half-finished run does not cause problems.
    _legacy_row(
        connection, "step", recipe_id=broken.hex, position=0, description="לטגן"
    )
    connection.commit()
    _upgrade(connection, config)
    for recipe_id, json_items in expected.items():
        assert _stored(connection, recipe_id) == json_items
    assert [i["name"] for i in _stored(connection, broken)["ingredients"]] == ["ביצים"]


def test_a_row_that_belongs_to_no_recipe_stops_the_migration(
    connection: Connection,
) -> None:
    config, _expected = _legacy_recipes(connection)
    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
    connection.commit()
    _legacy_row(
        connection, "ingredient", recipe_id=uuid.uuid4().hex, position=0, name="יתום"
    )
    connection.commit()
    connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    connection.commit()
    old_rows = _old_tables(connection)

    with pytest.raises(RuntimeError, match=r"row\(s\)"):
        _upgrade(connection, config)

    assert _old_tables(connection) == old_rows
