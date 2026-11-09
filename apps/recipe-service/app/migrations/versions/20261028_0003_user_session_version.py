"""a session version on users, so one user's sessions can all be ended at once

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-28 14:02:11.318402
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Every existing user starts at version 0. Their current tokens have no version,
    # which also counts as 0, so nobody is logged out.
    #
    # We use a plain ALTER TABLE and not batch mode. Batch mode rebuilds the table,
    # and while copying it, it would lose the index on lower(email) without any
    # warning (AD-30).
    op.add_column(
        "user",
        sa.Column(
            "session_version",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    # SQLite (3.35+) can drop a simple column directly. See upgrade() for why we do
    # not use batch mode.
    op.execute(sa.text('ALTER TABLE "user" DROP COLUMN session_version'))
