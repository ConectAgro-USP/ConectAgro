"""make created_at timezone aware

Revision ID: 08fbf5974c61
Revises: 2a098413a71f
Create Date: 2026-10-12 19:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "08fbf5974c61"
down_revision: str | None = "2a098413a71f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _set_created_at_timezone(timezone: bool) -> None:
    # o SQLite dos testes não guarda fuso nem aceita ALTER COLUMN TYPE
    if op.get_context().dialect.name != "postgresql":
        return
    for table in ("users", "products"):
        op.alter_column(
            table,
            "created_at",
            type_=sa.DateTime(timezone=timezone),
            postgresql_using="created_at AT TIME ZONE 'UTC'",
        )


def upgrade() -> None:
    _set_created_at_timezone(True)


def downgrade() -> None:
    _set_created_at_timezone(False)
