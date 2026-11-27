"""add building name search to apartments

Revision ID: 7f5f8a3cc230
Revises: a07a9be177b4
Create Date: 2026-11-24 10:00:00.000000

"""

import unicodedata
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import context, op

# revision identifiers, used by Alembic.
revision: str = "7f5f8a3cc230"
down_revision: str | None = "a07a9be177b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def fold(text: str | None) -> str:
    # cópia do fold da aplicação, que a migração não importa
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    letters = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(letters.casefold().split())


def upgrade() -> None:
    op.add_column(
        "apartments",
        sa.Column("building_name_search", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )
    if context.is_offline_mode():
        # o sql gerado offline não lê as linhas, então só tira as maiúsculas
        op.execute("UPDATE apartments SET building_name_search = lower(building_name)")
    else:
        _fold_existing_names()
    with op.batch_alter_table("apartments") as batch_op:
        batch_op.alter_column("building_name_search", nullable=False)
    op.create_index(
        op.f("ix_apartments_building_name_search"), "apartments", ["building_name_search"]
    )


def _fold_existing_names() -> None:
    connection = op.get_bind()
    apartments = connection.execute(sa.text("SELECT id, building_name FROM apartments")).all()
    if apartments:
        connection.execute(
            sa.text("UPDATE apartments SET building_name_search = :folded WHERE id = :id"),
            [{"id": id_, "folded": fold(name)} for id_, name in apartments],
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_apartments_building_name_search"), table_name="apartments")
    op.drop_column("apartments", "building_name_search")
