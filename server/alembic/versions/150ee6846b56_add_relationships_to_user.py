"""add relationships to user

Revision ID: 150ee6846b56
Revises: 6195b74a7c55
Create Date: 2026-10-26 21:48:11.619464

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '150ee6846b56'
down_revision: str | None = '6195b74a7c55'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLES = ('apartments', 'buyers', 'farmers')

OLD_COLUMNS = ('name', 'picture_url', 'email', 'homephone', 'cellphone')


def upgrade() -> None:
    for table in TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=False))
            batch_op.drop_index(f'ix_{table}_email')
            batch_op.create_unique_constraint(f'uq_{table}_user_id', ['user_id'])
            batch_op.create_foreign_key(
                f'fk_{table}_user_id_users', 'users', ['user_id'], ['id']
            )
            for column in OLD_COLUMNS:
                batch_op.drop_column(column)


def downgrade() -> None:
    for table in TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(f'fk_{table}_user_id_users', type_='foreignkey')
            batch_op.drop_constraint(f'uq_{table}_user_id', type_='unique')
            batch_op.add_column(sa.Column('name', sa.String(), nullable=False))
            batch_op.add_column(sa.Column('picture_url', sa.String(), nullable=True))
            batch_op.add_column(sa.Column('email', sa.String(), nullable=False))
            batch_op.add_column(sa.Column('homephone', sa.String(), nullable=True))
            batch_op.add_column(sa.Column('cellphone', sa.String(), nullable=True))
            batch_op.create_index(f'ix_{table}_email', ['email'], unique=True)
            batch_op.drop_column('user_id')