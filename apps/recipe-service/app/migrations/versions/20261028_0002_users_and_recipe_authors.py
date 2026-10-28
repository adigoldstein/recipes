"""users, and the foreign keys from recipe authors to them

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-28 10:21:23.882957
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "editor",
                "admin",
                name="role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column(
            "is_blocked", sa.Boolean(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user")),
    )
    # lower(email) makes emails unique case-insensitively (AD-30).
    op.create_index(
        "uq_user_lower_email", "user", [sa.text("lower(email)")], unique=True
    )
    # Existing recipes have no author (NULL), so the new constraints hold already.
    with op.batch_alter_table("recipe", schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f("fk_recipe_created_by_user"),
            "user",
            ["created_by"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            batch_op.f("fk_recipe_updated_by_user"),
            "user",
            ["updated_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("recipe", schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f("fk_recipe_updated_by_user"), type_="foreignkey"
        )
        batch_op.drop_constraint(
            batch_op.f("fk_recipe_created_by_user"), type_="foreignkey"
        )

    op.drop_index("uq_user_lower_email", table_name="user")
    op.drop_table("user")
