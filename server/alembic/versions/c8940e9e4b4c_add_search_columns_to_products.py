"""add search columns to products

Revision ID: c8940e9e4b4c
Revises: ff9291f5b288
Create Date: 2026-11-24 10:00:00.000000

"""

import unicodedata
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import context, op

# revision identifiers, used by Alembic.
revision: str = "c8940e9e4b4c"
down_revision: str | None = "ff9291f5b288"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SEARCH_COLUMNS = ("name_search", "description_search")


def fold(text: str | None) -> str:
    # cópia do fold da aplicação, que a migração não importa
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    letters = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(letters.casefold().split())


def upgrade() -> None:
    for column in SEARCH_COLUMNS:
        op.add_column(
            "products",
            sa.Column(column, sa.String(), nullable=False, server_default=""),
        )
    op.create_index(op.f("ix_products_name_search"), "products", ["name_search"], unique=False)

    if context.is_offline_mode():
        # o sql gerado offline não lê as linhas, então só tira as maiúsculas
        op.execute(
            "UPDATE products SET name_search = lower(name), "
            "description_search = lower(coalesce(description, ''))"
        )
        return
    connection = op.get_bind()
    products = connection.execute(sa.text("SELECT id, name, description FROM products"))
    rows = [
        {"id": row.id, "name_search": fold(row.name), "description_search": fold(row.description)}
        for row in products
    ]
    if rows:
        connection.execute(
            sa.text(
                "UPDATE products SET name_search = :name_search, "
                "description_search = :description_search WHERE id = :id"
            ),
            rows,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_products_name_search"), table_name="products")
    for column in SEARCH_COLUMNS:
        op.drop_column("products", column)
