"""add session version to users

Revision ID: fabf6295bb8b
Revises: f37fed4a28e4
Create Date: 2026-11-03 20:20:50.468963

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fabf6295bb8b"
down_revision: str | None = "f37fed4a28e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "session_version")
