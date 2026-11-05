"""import_attempts.upstream_status: the HTTP status a provider returned on a failure

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-05 13:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "import_attempts",
        sa.Column("upstream_status", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    with op.batch_alter_table("import_attempts") as batch:
        batch.drop_column("upstream_status")
