"""add unit to products

Revision ID: 8b1c98fb0e68
Revises: c8940e9e4b4c
Create Date: 2026-11-24 11:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8b1c98fb0e68"
down_revision: str | None = "c8940e9e4b4c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # os produtos já cadastrados eram todos vendidos por quilo
    op.add_column(
        "products",
        sa.Column("unit", sa.String(length=10), nullable=False, server_default="kg"),
    )


def downgrade() -> None:
    op.drop_column("products", "unit")
