"""add fuzzy product search indexes

Revision ID: c19d4b8e3f2a
Revises: fabf6295bb8b
Create Date: 2026-11-06 09:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c19d4b8e3f2a"
down_revision: str | None = "fabf6295bb8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.conectagro_unaccent(text)
        RETURNS text
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
        STRICT
        AS $$
            SELECT public.unaccent('public.unaccent'::regdictionary, $1)
        $$
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_products_name_trgm
        ON products USING gin (public.conectagro_unaccent(lower(name)) gin_trgm_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_products_description_trgm
        ON products USING gin (
            public.conectagro_unaccent(lower(coalesce(description, ''))) gin_trgm_ops
        )
        """
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("DROP INDEX IF EXISTS ix_products_description_trgm")
    op.execute("DROP INDEX IF EXISTS ix_products_name_trgm")
    op.execute("DROP FUNCTION IF EXISTS public.conectagro_unaccent(text)")
