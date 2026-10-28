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
    # Every existing user starts at 0, the version their current tokens already
    # carry (a token without the claim counts as 0), so nobody is signed out.
    #
    # Plain ALTER TABLE, not batch mode: a batch rebuild would copy the table through
    # reflection, which skips the expression index on lower(email) and would silently
    # drop it (AD-30).
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
    # SQLite can drop a plain column in place (3.35+); see upgrade() for why not batch.
    op.execute(sa.text('ALTER TABLE "user" DROP COLUMN session_version'))
