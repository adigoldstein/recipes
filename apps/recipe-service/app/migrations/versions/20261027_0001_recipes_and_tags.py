"""recipes, ingredients, steps, tags and the default pinned tags

Revision ID: 0001
Revises:
Create Date: 2026-10-27 00:09:52.034911
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Fixed ids, written out here on purpose: later code and data may refer to them.
# The order here is the display order of the pinned quick-filter chips.
DEFAULT_PINNED_TAGS = (
    ("64e93de0-47ad-4b2a-b757-d0c2405d8126", "בוקר"),
    ("8bbb49dd-fd17-4cc9-81ce-c4ad66596822", "בראנץ'"),
    ("c1276f9e-4f5c-4ec3-939f-cb4ddd7e318c", "צהריים"),
    ("98a5dc19-8766-4b69-aabd-3de927b323db", "ערב"),
    ("1609a770-c38d-4b8d-8f28-a95ed6fa6732", "נשנוש"),
    ("b0dd310e-7b26-40bb-b84f-d7786e66a6c9", "עיקרית"),
    ("8439c327-3a06-420d-a023-3f03be244771", "תוספת"),
    ("21809fb2-0977-4720-a674-62add6612269", "מנה ראשונה/סלט"),
    ("fbcdee8b-29c4-4f71-ac8d-cef61633124e", "מרק"),
    ("f4b05b85-91fe-450c-960b-28248e193e57", "מאפה"),
    ("2f188c64-03a8-4405-b992-8352eae65909", "קינוח"),
    ("836726ed-b2bf-4fde-8238-fd9060622378", "משקה"),
    ("5bf1bf65-6cb5-44bc-88c3-fe3e74b809a7", "רוטב/ממרח"),
)


def upgrade() -> None:
    op.create_table(
        "recipe",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("base_servings", sa.Integer(), nullable=False),
        sa.Column("prep_time_minutes", sa.Integer(), nullable=True),
        sa.Column("cook_time_minutes", sa.Integer(), nullable=True),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recipe")),
    )
    op.create_table(
        "tag",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("pinned", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tag")),
    )
    # lower(name) makes tag names unique case-insensitively (AD-7).
    op.create_index("uq_tag_lower_name", "tag", [sa.text("lower(name)")], unique=True)
    op.bulk_insert(
        sa.table(
            "tag",
            sa.column("id", sa.Uuid()),
            sa.column("name", sa.String()),
            sa.column("pinned", sa.Boolean()),
            sa.column("sort_order", sa.Integer()),
        ),
        [
            {"id": uuid.UUID(id_), "name": name, "pinned": True, "sort_order": i}
            for i, (id_, name) in enumerate(DEFAULT_PINNED_TAGS)
        ],
    )

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
                "oz",
                "lb",
                "fl_oz",
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
        "recipe_tag",
        sa.Column("recipe_id", sa.Uuid(), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["recipe_id"],
            ["recipe.id"],
            name=op.f("fk_recipe_tag_recipe_id_recipe"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["tag.id"],
            name=op.f("fk_recipe_tag_tag_id_tag"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("recipe_id", "tag_id", name=op.f("pk_recipe_tag")),
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
    with op.batch_alter_table("step", schema=None) as batch_op:
        batch_op.drop_index("ix_step_recipe_id_position")

    op.drop_table("step")
    op.drop_table("recipe_tag")
    with op.batch_alter_table("ingredient", schema=None) as batch_op:
        batch_op.drop_index("ix_ingredient_recipe_id_position")

    op.drop_table("ingredient")
    op.drop_index("uq_tag_lower_name", table_name="tag")
    op.drop_table("tag")
    op.drop_table("recipe")
