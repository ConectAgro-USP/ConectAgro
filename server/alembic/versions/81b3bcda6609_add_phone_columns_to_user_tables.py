"""add phone columns to user tables

Revision ID: 81b3bcda6609
Revises: b3d5fe8c96fb
Create Date: 2026-10-24 10:42:29.098856

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "81b3bcda6609"
down_revision: str | None = "b3d5fe8c96fb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USER_TABLES = ("apartments", "buyers", "farmers", "users")
PHONE_COLUMNS = ("cellphone", "homephone")


def upgrade() -> None:
    for table in USER_TABLES:
        for column in PHONE_COLUMNS:
            op.add_column(
                table, sa.Column(column, sqlmodel.sql.sqltypes.AutoString(), nullable=True)
            )


def downgrade() -> None:
    for table in USER_TABLES:
        for column in PHONE_COLUMNS:
            op.drop_column(table, column)
