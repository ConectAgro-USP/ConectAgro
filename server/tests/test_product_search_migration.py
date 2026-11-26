from datetime import date
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlmodel import create_engine

from alembic import command
from src.core.config import settings
from tests.test_migrations import alembic_config

BEFORE_SEARCH_COLUMNS = "ff9291f5b288"
SEARCH_COLUMNS = "c8940e9e4b4c"


@pytest.fixture()
def db_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    return url


def test_upgrade_fills_the_search_columns_of_existing_products(db_url: str) -> None:
    command.upgrade(alembic_config(), BEFORE_SEARCH_COLUMNS)
    engine = create_engine(db_url)
    with engine.begin() as connection:
        # SQL cru, porque o model Product descreve o schema do head
        connection.execute(
            text(
                "INSERT INTO users (email, name, created_at) "
                "VALUES ('joao@example.com', 'João', CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO farmers (public_id, zip_code, user_id) "
                "VALUES (:public_id, '01310200', 1)"
            ),
            {"public_id": uuid4().hex},
        )
        connection.execute(
            text(
                "INSERT INTO products (public_id, name, description, quantity, price, "
                "expiration_date, created_at, farmer_id, is_available) VALUES (:public_id, "
                ":name, :description, 5, 3, :expiration, CURRENT_TIMESTAMP, 1, 1)"
            ),
            [
                {
                    "public_id": uuid4().hex,
                    "name": "Feijão  Carioca",
                    "description": "Grãos ORGÂNICOS",
                    "expiration": date(2030, 1, 1),
                },
                {
                    "public_id": uuid4().hex,
                    "name": "Maçã",
                    "description": None,
                    "expiration": date(2030, 1, 1),
                },
            ],
        )

    command.upgrade(alembic_config(), SEARCH_COLUMNS)

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT name_search, description_search FROM products ORDER BY id")
        ).all()
    engine.dispose()

    assert [tuple(row) for row in rows] == [("feijao carioca", "graos organicos"), ("maca", "")]


def test_downgrade_removes_the_search_columns(db_url: str) -> None:
    command.upgrade(alembic_config(), SEARCH_COLUMNS)
    command.downgrade(alembic_config(), BEFORE_SEARCH_COLUMNS)

    engine = create_engine(db_url)
    with engine.connect() as connection:
        columns = connection.execute(text("PRAGMA table_info(products)")).all()
    engine.dispose()

    assert {"name_search", "description_search"}.isdisjoint(column.name for column in columns)


def test_offline_sql_lowercases_the_search_columns(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://u:p@localhost/db")

    command.upgrade(alembic_config(), f"{BEFORE_SEARCH_COLUMNS}:{SEARCH_COLUMNS}", sql=True)

    assert (
        "UPDATE products SET name_search = lower(name), "
        "description_search = lower(coalesce(description, ''))"
    ) in capsys.readouterr().out
