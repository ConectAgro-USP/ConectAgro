"""add block and unit to buyer

Revision ID: 74d153449378
Revises: 150ee6846b56
Create Date: 2026-10-27 11:40:20.109295
"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "74d153449378"
down_revision: str | None = "150ee6846b56"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


link_status_enum = sa.Enum(
    "PENDENTE",
    "APROVADO",
    "RECUSADO",
    name="linkstatus",
)


def upgrade() -> None:
    # Create PostgreSQL ENUM type before using it.
    link_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "buyers",
        sa.Column("block", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )

    op.add_column(
        "buyers",
        sa.Column(
            "unit",
            sqlmodel.sql.sqltypes.AutoString(length=10),
            nullable=False,
            server_default="",
        ),
    )

    op.add_column(
        "buyers",
        sa.Column(
            "link_status",
            link_status_enum,
            nullable=False,
            server_default="PENDENTE",
        ),
    )

    op.add_column(
        "buyers",
        sa.Column(
            "link_reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Remove temporary defaults.
    if op.get_bind().dialect.name == "postgresql":
        op.alter_column("buyers", "unit", server_default=None)
        op.alter_column("buyers", "link_status", server_default=None)


def downgrade() -> None:
    op.drop_column("buyers", "link_reviewed_at")
    op.drop_column("buyers", "link_status")
    op.drop_column("buyers", "unit")
    op.drop_column("buyers", "block")

    link_status_enum.drop(op.get_bind(), checkfirst=True)
