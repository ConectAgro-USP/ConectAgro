"""refactor purchase model into purchase parts

Revision ID: e0ed8ac0498c
Revises: 3d12241f5496
Create Date: 2026-11-01 18:40:18.747625

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e0ed8ac0498c"
down_revision: str | None = "3d12241f5496"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "purchase_parts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("public_id", sa.Uuid(), nullable=False),
        sa.Column("purchase_id", sa.Integer(), nullable=False),
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("EM_PROGRESSO", "ENTREGUE", "CANCELADA", name="purchasestatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.id"]),
        sa.ForeignKeyConstraint(["purchase_id"], ["purchases.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "purchase_id", "farmer_id", name="uq_purchase_parts_purchase_farmer"
        ),
    )
    op.create_index(
        op.f("ix_purchase_parts_farmer_id"),
        "purchase_parts",
        ["farmer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_purchase_parts_public_id"),
        "purchase_parts",
        ["public_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_purchase_parts_purchase_id"),
        "purchase_parts",
        ["purchase_id"],
        unique=False,
    )

    with op.batch_alter_table("purchase_products", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("purchase_part_id", sa.Integer(), nullable=False)
        )
        batch_op.create_index(
            batch_op.f("ix_purchase_products_purchase_part_id"),
            ["purchase_part_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_purchase_products_purchase_parts",
            "purchase_parts",
            ["purchase_part_id"],
            ["id"],
        )
        batch_op.drop_column("purchase_id")

    with op.batch_alter_table("purchases", schema=None) as batch_op:
        batch_op.drop_index("ix_purchases_farmer_id")
        batch_op.drop_column("status")
        batch_op.drop_column("farmer_id")


def downgrade() -> None:
    with op.batch_alter_table("purchases", schema=None) as batch_op:
        batch_op.add_column(sa.Column("farmer_id", sa.INTEGER(), nullable=False))
        batch_op.add_column(
            sa.Column("status", sa.VARCHAR(length=12), nullable=False)
        )
        batch_op.create_foreign_key(
            "fk_purchases_farmers", "farmers", ["farmer_id"], ["id"]
        )
        batch_op.create_index(
            "ix_purchases_farmer_id", ["farmer_id"], unique=False
        )

    with op.batch_alter_table("purchase_products", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("purchase_id", sa.INTEGER(), nullable=False)
        )
        batch_op.create_foreign_key(
            "fk_purchase_products_purchases",
            "purchases",
            ["purchase_id"],
            ["id"],
        )
        batch_op.drop_index(
            batch_op.f("ix_purchase_products_purchase_part_id")
        )
        batch_op.drop_column("purchase_part_id")

    op.drop_index(
        op.f("ix_purchase_parts_purchase_id"), table_name="purchase_parts"
    )
    op.drop_index(
        op.f("ix_purchase_parts_public_id"), table_name="purchase_parts"
    )
    op.drop_index(
        op.f("ix_purchase_parts_farmer_id"), table_name="purchase_parts"
    )
    op.drop_table("purchase_parts")