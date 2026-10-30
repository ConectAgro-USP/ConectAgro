"""merge reviews and apartment changes

Revision ID: 3d12241f5496
Revises: a0115862eaa8, bf9ddab47922
Create Date: 2026-10-30 16:24:21.809869

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '3d12241f5496'
down_revision: str | None = ('a0115862eaa8', 'bf9ddab47922')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
