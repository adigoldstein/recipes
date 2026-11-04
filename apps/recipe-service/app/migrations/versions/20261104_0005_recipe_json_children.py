"""ingredients and steps move inside the recipe as JSON (AD-41, Story 4.R)

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-04 14:10:00.000000

Upgrade: back up the database file, add `recipe.ingredients` and `recipe.steps`, copy
every `ingredient` and `step` row into them in `position` order, check that nothing was
lost, and only then drop the two tables. Downgrade rebuilds the tables from the JSON.

Like 0001 to 0004 this file imports nothing from the app: it must run the same forever.
"""

import sqlite3
import uuid
from collections import defaultdict
from collections.abc import Sequence
from decimal import Decimal
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BACKUP_SUFFIX = ".bak-before-json"
QUANTUM = Decimal("0.001")
UNITS = (
    "g",
    "kg",
    "ml",
    "l",
    "tsp",
    "tbsp",
    "cup",
    "unit",
    "pinch",
    "clove",
    "slice",
    "can",
    "package",
)
SOURCE_UNITS = ("oz", "lb", "fl_oz")

_recipe = sa.table(
    "recipe",
    sa.column("id", sa.Uuid()),
    sa.column("ingredients", sa.JSON()),
    sa.column("steps", sa.JSON()),
)
_ingredient = sa.table(
    "ingredient",
    sa.column("id", sa.Uuid()),
    sa.column("recipe_id", sa.Uuid()),
    sa.column("position", sa.Integer()),
    sa.column("name", sa.String()),
    sa.column("note", sa.String()),
    sa.column("amount", sa.Numeric(precision=12, scale=3)),
    sa.column("unit", sa.String()),
    sa.column("has_original", sa.Boolean()),
    sa.column("original_amount", sa.Numeric(precision=12, scale=3)),
    sa.column("original_unit", sa.String()),
    sa.column("source_amount", sa.Numeric(precision=12, scale=3)),
    sa.column("source_unit", sa.String()),
)
_step = sa.table(
    "step",
    sa.column("id", sa.Uuid()),
    sa.column("recipe_id", sa.Uuid()),
    sa.column("position", sa.Integer()),
    sa.column("description", sa.Text()),
    sa.column("source_text", sa.Text()),
)


def _text_amount(value: Decimal | None) -> str | None:
    """An amount as stored in the JSON: a string with 3 decimals (AD-31)."""
    return None if value is None else format(value.quantize(QUANTUM), "f")


def _decimal(value: str | None) -> Decimal | None:
    return None if value is None else Decimal(value).quantize(QUANTUM)


def _backup_database(bind: sa.Connection) -> None:
    """Copy the database file next to itself before anything changes.

    It uses SQLite's own backup API, which is safe in WAL mode, and it never replaces
    an earlier backup. A database with no recipes has nothing to protect.
    """
    if bind.execute(sa.text("SELECT count(*) FROM recipe")).scalar_one() == 0:
        return
    files = bind.exec_driver_sql("PRAGMA database_list").all()
    path = next((row[2] for row in files if row[1] == "main" and row[2]), None)
    if path is None:
        return
    target = Path(path).with_name(Path(path).name + BACKUP_SUFFIX)
    if target.exists():
        return
    # A second connection, not the migration's own: it sees only what is committed, so
    # the backup is the state before this run, and it cannot wait on the run's lock.
    source = sqlite3.connect(path)
    copy = sqlite3.connect(target)
    try:
        source.backup(copy)
    finally:
        copy.close()
        source.close()


def _count(bind: sa.Connection, sql: str) -> int:
    return int(bind.execute(sa.text(sql)).scalar_one())


def _verify_json_matches_rows(bind: sa.Connection) -> None:
    """Raise unless every row has a place in the JSON; the caller rolls back."""
    for table, column in (("ingredient", "ingredients"), ("step", "steps")):
        rows = _count(bind, f"SELECT count(*) FROM {table}")
        items = _count(
            bind, f"SELECT coalesce(sum(json_array_length({column})), 0) FROM recipe"
        )
        if rows != items:
            raise RuntimeError(
                f"Migration 0005 stopped: {rows} {table} row(s) but {items} item(s) "
                f"in the recipes' {column}; nothing was dropped"
            )
    empty = bind.execute(
        sa.text(
            "SELECT id FROM recipe "
            "WHERE json_array_length(ingredients) = 0 OR json_array_length(steps) = 0"
        )
    ).all()
    if empty:
        raise RuntimeError(
            f"Migration 0005 stopped: {len(empty)} recipe(s) would have no ingredients "
            "or no steps; nothing was dropped"
        )


def _has_column(bind: sa.Connection, table: str, column: str) -> bool:
    return any(c["name"] == column for c in sa.inspect(bind).get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    _backup_database(bind)
    # SQLite may run a plain ALTER outside the migration's transaction, so a failed
    # run can leave the columns behind; adding only what is missing makes a rerun safe.
    for column in ("ingredients", "steps"):
        if not _has_column(bind, "recipe", column):
            op.add_column(
                "recipe",
                sa.Column(
                    column, sa.JSON(), nullable=False, server_default=sa.text("'[]'")
                ),
            )

    ingredients: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for row in bind.execute(
        sa.select(_ingredient).order_by(
            _ingredient.c.recipe_id, _ingredient.c.position, _ingredient.c.id
        )
    ):
        has_source = row.source_amount is not None and row.source_unit is not None
        ingredients[row.recipe_id].append(
            {
                "id": str(row.id),
                "name": row.name,
                "note": row.note,
                "amount": _text_amount(row.amount),
                "unit": row.unit,
                "original": (
                    {
                        "amount": _text_amount(row.original_amount),
                        "unit": row.original_unit,
                    }
                    if row.has_original
                    else None
                ),
                "source": (
                    {
                        "amount": _text_amount(row.source_amount),
                        "unit": row.source_unit,
                    }
                    if has_source
                    else None
                ),
            }
        )
    steps: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for step_row in bind.execute(
        sa.select(_step).order_by(_step.c.recipe_id, _step.c.position, _step.c.id)
    ):
        steps[step_row.recipe_id].append(
            {
                "id": str(step_row.id),
                "description": step_row.description,
                "source_text": step_row.source_text,
            }
        )

    for (recipe_id,) in bind.execute(sa.select(_recipe.c.id)).all():
        bind.execute(
            sa.update(_recipe)
            .where(_recipe.c.id == recipe_id)
            .values(
                ingredients=ingredients.get(recipe_id, []),
                steps=steps.get(recipe_id, []),
            )
        )

    _verify_json_matches_rows(bind)
    with op.batch_alter_table("step", schema=None) as batch_op:
        batch_op.drop_index("ix_step_recipe_id_position")
    op.drop_table("step")
    with op.batch_alter_table("ingredient", schema=None) as batch_op:
        batch_op.drop_index("ix_ingredient_recipe_id_position")
    op.drop_table("ingredient")


def _create_child_tables() -> None:
    """The `ingredient` and `step` tables exactly as 0001 made them."""
    op.create_table(
        "ingredient",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipe_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column(
            "unit",
            sa.Enum(
                *UNITS,
                name="unit",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "has_original", sa.Boolean(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("original_amount", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column(
            "original_unit",
            sa.Enum(
                *UNITS,
                name="original_unit",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=True,
        ),
        sa.Column("source_amount", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column(
            "source_unit",
            sa.Enum(
                *SOURCE_UNITS,
                name="source_unit",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["recipe_id"],
            ["recipe.id"],
            name=op.f("fk_ingredient_recipe_id_recipe"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ingredient")),
    )
    with op.batch_alter_table("ingredient", schema=None) as batch_op:
        batch_op.create_index(
            "ix_ingredient_recipe_id_position", ["recipe_id", "position"], unique=False
        )
    op.create_table(
        "step",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipe_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["recipe_id"],
            ["recipe.id"],
            name=op.f("fk_step_recipe_id_recipe"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_step")),
    )
    with op.batch_alter_table("step", schema=None) as batch_op:
        batch_op.create_index(
            "ix_step_recipe_id_position", ["recipe_id", "position"], unique=False
        )


def downgrade() -> None:
    bind = op.get_bind()
    _create_child_tables()

    ingredient_rows: list[dict[str, Any]] = []
    step_rows: list[dict[str, Any]] = []
    for recipe_id, ingredients, steps in bind.execute(
        sa.select(_recipe.c.id, _recipe.c.ingredients, _recipe.c.steps)
    ).all():
        for position, item in enumerate(ingredients):
            original, source = item["original"], item["source"]
            ingredient_rows.append(
                {
                    "id": uuid.UUID(item["id"]),
                    "recipe_id": recipe_id,
                    "position": position,
                    "name": item["name"],
                    "note": item["note"],
                    "amount": _decimal(item["amount"]),
                    "unit": item["unit"],
                    "has_original": original is not None,
                    "original_amount": _decimal(original["amount"])
                    if original
                    else None,
                    "original_unit": original["unit"] if original else None,
                    "source_amount": _decimal(source["amount"]) if source else None,
                    "source_unit": source["unit"] if source else None,
                }
            )
        for position, step in enumerate(steps):
            step_rows.append(
                {
                    "id": uuid.UUID(step["id"]),
                    "recipe_id": recipe_id,
                    "position": position,
                    "description": step["description"],
                    "source_text": step["source_text"],
                }
            )
    if ingredient_rows:
        bind.execute(sa.insert(_ingredient), ingredient_rows)
    if step_rows:
        bind.execute(sa.insert(_step), step_rows)

    for table, column, expected in (
        ("ingredient", "ingredients", len(ingredient_rows)),
        ("step", "steps", len(step_rows)),
    ):
        rows = _count(bind, f"SELECT count(*) FROM {table}")
        if rows != expected:
            raise RuntimeError(
                f"Downgrade of 0005 stopped: {rows} {table} row(s) but {expected} "
                f"item(s) in the recipes' {column}"
            )
    op.execute(sa.text("ALTER TABLE recipe DROP COLUMN steps"))
    op.execute(sa.text("ALTER TABLE recipe DROP COLUMN ingredients"))
