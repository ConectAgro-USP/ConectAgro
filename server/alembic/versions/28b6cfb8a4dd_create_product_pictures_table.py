"""create product pictures table

Revision ID: 28b6cfb8a4dd
Revises: 8b1c98fb0e68
Create Date: 2026-11-24 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "28b6cfb8a4dd"
down_revision: str | None = "8b1c98fb0e68"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "product_pictures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("etag", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id"),
    )


def downgrade() -> None:
    op.drop_table("product_pictures")
