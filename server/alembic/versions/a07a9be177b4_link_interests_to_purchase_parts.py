"""link interests to purchase parts

Revision ID: a07a9be177b4
Revises: 28b6cfb8a4dd
Create Date: 2026-11-24 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a07a9be177b4"
down_revision: str | None = "28b6cfb8a4dd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PURCHASE_PART_FOREIGN_KEY = "fk_interests_purchase_part_id_purchase_parts"


def upgrade() -> None:
    with op.batch_alter_table("interests") as batch_op:
        batch_op.add_column(sa.Column("purchase_part_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            PURCHASE_PART_FOREIGN_KEY,
            "purchase_parts",
            ["purchase_part_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(op.f("ix_interests_purchase_part_id"), ["purchase_part_id"])


def downgrade() -> None:
    with op.batch_alter_table("interests") as batch_op:
        batch_op.drop_index(op.f("ix_interests_purchase_part_id"))
        batch_op.drop_constraint(PURCHASE_PART_FOREIGN_KEY, type_="foreignkey")
        batch_op.drop_column("purchase_part_id")
