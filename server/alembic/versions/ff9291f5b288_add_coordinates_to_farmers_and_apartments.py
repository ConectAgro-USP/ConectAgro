"""add coordinates to farmers and apartments

Revision ID: ff9291f5b288
Revises: 43469600e031
Create Date: 2026-11-19 11:16:44.626038

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ff9291f5b288"
down_revision: str | None = "43469600e031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOCATED_TABLES = ("apartments", "farmers")
COORDINATE_COLUMNS = ("latitude", "longitude")


def upgrade() -> None:
    for table in LOCATED_TABLES:
        for column in COORDINATE_COLUMNS:
            op.add_column(table, sa.Column(column, sa.Float(), nullable=True))


def downgrade() -> None:
    for table in LOCATED_TABLES:
        for column in COORDINATE_COLUMNS:
            op.drop_column(table, column)
