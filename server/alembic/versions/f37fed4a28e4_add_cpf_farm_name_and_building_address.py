"""add cpf, farm name and building address

Revision ID: f37fed4a28e4
Revises: e0ed8ac0498c
Create Date: 2026-11-03 13:41:59.934851

"""
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f37fed4a28e4"
down_revision: str | None = "e0ed8ac0498c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("cpf", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f("ix_users_cpf"), "users", ["cpf"], unique=True)
    op.add_column(
        "farmers", sa.Column("farm_name", sqlmodel.sql.sqltypes.AutoString(), nullable=True)
    )
    op.add_column(
        "apartments", sa.Column("address", sqlmodel.sql.sqltypes.AutoString(), nullable=True)
    )
    op.create_index(op.f("ix_apartments_building_cnpj"), "apartments", ["building_cnpj"])


def downgrade() -> None:
    op.drop_index(op.f("ix_apartments_building_cnpj"), table_name="apartments")
    op.drop_column("apartments", "address")
    op.drop_column("farmers", "farm_name")
    op.drop_index(op.f("ix_users_cpf"), table_name="users")
    op.drop_column("users", "cpf")
