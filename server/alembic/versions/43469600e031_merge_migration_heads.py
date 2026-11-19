"""merge migration heads

Revision ID: 43469600e031
Revises: c41d9a7e5b20, d2e34a671a18
Create Date: 2026-11-18 22:14:54.218795

"""
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '43469600e031'
down_revision: str | None = ('c41d9a7e5b20', 'd2e34a671a18')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
