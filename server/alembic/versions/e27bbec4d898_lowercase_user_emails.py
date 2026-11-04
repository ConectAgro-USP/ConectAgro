"""lowercase user emails

Revision ID: e27bbec4d898
Revises: 08fbf5974c61
Create Date: 2026-10-12 22:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e27bbec4d898"
down_revision: str | None = "08fbf5974c61"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # a API passou a buscar o e-mail em minúsculas, mas contas antigas guardam a caixa digitada
    # e-mails que só diferem na caixa ficam intactos, e a conta a manter se escolhe à mão
    op.execute(
        "UPDATE users SET email = lower(email) WHERE email <> lower(email) AND lower(email) IN "
        "(SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) = 1)"
    )


def downgrade() -> None:
    # a caixa original não fica guardada, e o e-mail em minúsculas vale no schema anterior
    pass
