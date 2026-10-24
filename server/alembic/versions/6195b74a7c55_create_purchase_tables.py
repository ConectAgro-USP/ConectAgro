"""create purchase tables

Revision ID: 6195b74a7c55
Revises: 81b3bcda6609
Create Date: 2026-10-24 13:29:55.852265

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6195b74a7c55"
down_revision: str | None = "81b3bcda6609"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

purchase_status = sa.Enum("EM_PROGRESSO", "ENTREGUE", "CANCELADA", name="purchasestatus")


def upgrade() -> None:
    op.create_table(
        "purchases",
        sa.Column("expected_delivery_date", sa.Date(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("public_id", sa.Uuid(), nullable=False),
        sa.Column("status", purchase_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["apartment_id"], ["apartments.id"]),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_purchases_apartment_id"), "purchases", ["apartment_id"], unique=False)
    op.create_index(op.f("ix_purchases_farmer_id"), "purchases", ["farmer_id"], unique=False)
    op.create_index(op.f("ix_purchases_public_id"), "purchases", ["public_id"], unique=True)
    op.create_table(
        "purchase_products",
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column("purchase_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["purchase_id"], ["purchases.id"]),
        sa.PrimaryKeyConstraint("purchase_id", "product_id"),
    )
    op.create_index(
        op.f("ix_purchase_products_product_id"), "purchase_products", ["product_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_purchase_products_product_id"), table_name="purchase_products")
    op.drop_table("purchase_products")
    op.drop_index(op.f("ix_purchases_public_id"), table_name="purchases")
    op.drop_index(op.f("ix_purchases_farmer_id"), table_name="purchases")
    op.drop_index(op.f("ix_purchases_apartment_id"), table_name="purchases")
    op.drop_table("purchases")
    purchase_status.drop(op.get_bind())
