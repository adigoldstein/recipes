"""a photo key and its credit domain on recipes

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-29 12:10:02.447913
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Plain ALTER TABLE, not batch mode, as in 0003: nothing is rebuilt or dropped.
    op.add_column("recipe", sa.Column("photo_key", sa.String(length=32), nullable=True))
    op.add_column(
        "recipe", sa.Column("photo_credit_domain", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE recipe DROP COLUMN photo_credit_domain"))
    op.execute(sa.text("ALTER TABLE recipe DROP COLUMN photo_key"))
