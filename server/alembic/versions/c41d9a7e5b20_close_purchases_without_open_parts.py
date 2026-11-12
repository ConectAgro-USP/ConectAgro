"""close purchases without open parts

Revision ID: c41d9a7e5b20
Revises: fabf6295bb8b
Create Date: 2026-11-12 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c41d9a7e5b20"
down_revision: str | None = "fabf6295bb8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # a compra com partes entregues e canceladas ficava aberta, agora fecha na última parte
    op.execute(
        "UPDATE purchases SET closed_at = (SELECT max(purchase_parts.closed_at) "
        "FROM purchase_parts WHERE purchase_parts.purchase_id = purchases.id) "
        "WHERE closed_at IS NULL AND NOT EXISTS (SELECT 1 FROM purchase_parts "
        "WHERE purchase_parts.purchase_id = purchases.id "
        "AND purchase_parts.status = 'EM_PROGRESSO')"
    )


def downgrade() -> None:
    # a data de encerramento não atrapalha a regra antiga, então fica como está
    pass
