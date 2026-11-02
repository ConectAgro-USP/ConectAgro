"""add link requested at, buyer apartment index and unique building cnpj

Revision ID: 165a46c43d78
Revises: 3d12241f5496
Create Date: 2026-11-02 10:23:27.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '165a46c43d78'
down_revision: str | None = '3d12241f5496'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'buyers', sa.Column('link_requested_at', sa.DateTime(timezone=True), nullable=True)
    )
    # pedidos antigos não guardaram a data, então recebem a data da migração
    op.execute('UPDATE buyers SET link_requested_at = CURRENT_TIMESTAMP')
    with op.batch_alter_table('buyers') as batch_op:
        batch_op.alter_column(
            'link_requested_at', existing_type=sa.DateTime(timezone=True), nullable=False
        )
        batch_op.create_index('ix_buyers_apartment_id', ['apartment_id'], unique=False)

    with op.batch_alter_table('apartments') as batch_op:
        batch_op.create_unique_constraint('uq_apartments_building_cnpj', ['building_cnpj'])


def downgrade() -> None:
    with op.batch_alter_table('apartments') as batch_op:
        batch_op.drop_constraint('uq_apartments_building_cnpj', type_='unique')

    with op.batch_alter_table('buyers') as batch_op:
        batch_op.drop_index('ix_buyers_apartment_id')
        batch_op.drop_column('link_requested_at')
