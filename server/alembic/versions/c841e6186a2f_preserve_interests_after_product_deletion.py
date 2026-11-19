"""preserve interests after product deletion

Revision ID: c841e6186a2f
Revises: fabf6295bb8b
Create Date: 2026-11-15 18:25:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision: str = "c841e6186a2f"
down_revision: str | None = "fabf6295bb8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


INTERESTS_FOREIGN_KEY_NAMING = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"
}
PRODUCT_FOREIGN_KEY = "fk_interests_product_id_products"


def _product_foreign_key_name() -> str:
    if context.is_offline_mode():
        return "interests_product_id_fkey"
    foreign_keys = sa.inspect(op.get_bind()).get_foreign_keys("interests")
    product_foreign_key = next(
        foreign_key
        for foreign_key in foreign_keys
        if foreign_key["constrained_columns"] == ["product_id"]
    )
    return product_foreign_key["name"] or PRODUCT_FOREIGN_KEY


def upgrade() -> None:
    op.add_column(
        "interests", sa.Column("product_public_id_snapshot", sa.Uuid(), nullable=True)
    )
    op.add_column(
        "interests", sa.Column("product_name_snapshot", sa.String(), nullable=True)
    )
    op.execute(
        sa.text(
            "UPDATE interests "
            "SET product_public_id_snapshot = ("
            "SELECT products.public_id FROM products WHERE products.id = interests.product_id"
            "), product_name_snapshot = ("
            "SELECT products.name FROM products WHERE products.id = interests.product_id"
            ")"
        )
    )

    product_foreign_key = _product_foreign_key_name()
    with op.batch_alter_table(
        "interests", naming_convention=INTERESTS_FOREIGN_KEY_NAMING
    ) as batch_op:
        batch_op.drop_constraint(product_foreign_key, type_="foreignkey")
        batch_op.alter_column("product_id", existing_type=sa.Integer(), nullable=True)
        batch_op.create_foreign_key(
            PRODUCT_FOREIGN_KEY,
            "products",
            ["product_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM interests WHERE product_id IS NULL"))
    product_foreign_key = _product_foreign_key_name()
    with op.batch_alter_table(
        "interests", naming_convention=INTERESTS_FOREIGN_KEY_NAMING
    ) as batch_op:
        batch_op.drop_constraint(product_foreign_key, type_="foreignkey")
        batch_op.alter_column("product_id", existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key(
            PRODUCT_FOREIGN_KEY,
            "products",
            ["product_id"],
            ["id"],
            ondelete="CASCADE",
        )
    op.drop_column("interests", "product_name_snapshot")
    op.drop_column("interests", "product_public_id_snapshot")