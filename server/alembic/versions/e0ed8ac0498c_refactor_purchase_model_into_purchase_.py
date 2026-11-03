"""refactor purchase model into purchase parts

Revision ID: e0ed8ac0498c
Revises: 165a46c43d78
Create Date: 2026-11-01 18:40:18.747625

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e0ed8ac0498c"
down_revision: str | None = "165a46c43d78"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# o tipo já existe no PostgreSQL desde a 6195b74a7c55
purchase_status = postgresql.ENUM(
    "EM_PROGRESSO", "ENTREGUE", "CANCELADA", name="purchasestatus", create_type=False
)


def upgrade() -> None:
    # nenhuma rota cria compras ainda, então não há dados para copiar
    op.create_table(
        "purchase_parts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("public_id", sa.Uuid(), nullable=False),
        sa.Column("purchase_id", sa.Integer(), nullable=False),
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.Column("status", purchase_status, nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.id"]),
        sa.ForeignKeyConstraint(["purchase_id"], ["purchases.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("purchase_id", "farmer_id", name="uq_purchase_parts_purchase_farmer"),
    )
    op.create_index(
        op.f("ix_purchase_parts_public_id"), "purchase_parts", ["public_id"], unique=True
    )
    op.create_index(op.f("ix_purchase_parts_farmer_id"), "purchase_parts", ["farmer_id"])

    with op.batch_alter_table("purchase_products") as batch_op:
        batch_op.drop_column("purchase_id")
        batch_op.add_column(sa.Column("purchase_part_id", sa.Integer(), nullable=False))
        batch_op.create_foreign_key(
            "purchase_products_purchase_part_id_fkey",
            "purchase_parts",
            ["purchase_part_id"],
            ["id"],
        )
        batch_op.create_primary_key("purchase_products_pkey", ["purchase_part_id", "product_id"])

    with op.batch_alter_table("purchases") as batch_op:
        batch_op.drop_index("ix_purchases_farmer_id")
        batch_op.drop_column("farmer_id")
        batch_op.drop_column("status")


def downgrade() -> None:
    with op.batch_alter_table("purchases") as batch_op:
        batch_op.add_column(sa.Column("status", purchase_status, nullable=False))
        batch_op.add_column(sa.Column("farmer_id", sa.Integer(), nullable=False))
        batch_op.create_foreign_key("purchases_farmer_id_fkey", "farmers", ["farmer_id"], ["id"])
        batch_op.create_index("ix_purchases_farmer_id", ["farmer_id"])

    with op.batch_alter_table("purchase_products") as batch_op:
        batch_op.drop_column("purchase_part_id")
        batch_op.add_column(sa.Column("purchase_id", sa.Integer(), nullable=False))
        batch_op.create_foreign_key(
            "purchase_products_purchase_id_fkey", "purchases", ["purchase_id"], ["id"]
        )
        batch_op.create_primary_key("purchase_products_pkey", ["purchase_id", "product_id"])

    op.drop_table("purchase_parts")
