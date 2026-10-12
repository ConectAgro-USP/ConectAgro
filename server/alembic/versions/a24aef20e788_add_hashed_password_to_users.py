"""add hashed_password to users

Revision ID: a24aef20e788
Revises: 99663355dec9
Create Date: 2026-10-12 16:17:33.713308

"""
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a24aef20e788'
down_revision: str | None = '99663355dec9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('hashed_password', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'hashed_password')
