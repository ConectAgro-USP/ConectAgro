from pathlib import Path

import pytest
from sqlalchemy import text
from sqlmodel import create_engine

from alembic import command
from src.core.config import settings
from tests.test_migrations import alembic_config

BEFORE_SEARCH = "ff9291f5b288"


@pytest.fixture()
def db_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    return url


def test_upgrade_folds_the_names_of_existing_buildings(db_url: str) -> None:
    command.upgrade(alembic_config(), BEFORE_SEARCH)
    engine = create_engine(db_url)
    with engine.begin() as connection:
        # SQL cru, porque o model Apartment descreve o schema do head
        connection.execute(
            text(
                "INSERT INTO users (email, name, created_at, session_version) "
                "VALUES (:email, 'Síndico', CURRENT_TIMESTAMP, 0)"
            ),
            [{"email": "a@example.com"}, {"email": "b@example.com"}],
        )
        connection.execute(
            text(
                "INSERT INTO apartments "
                "(public_id, zip_code, building_name, building_cnpj, manager_id) "
                "VALUES (:public_id, '01310200', :name, '00000000000191', :manager_id)"
            ),
            [
                {"public_id": "a" * 32, "name": "Edifício  ARARAQUARA", "manager_id": 1},
                {"public_id": "b" * 32, "name": "Condomínio São João", "manager_id": 2},
            ],
        )

    command.upgrade(alembic_config(), "head")

    with engine.connect() as connection:
        folded = connection.execute(
            text("SELECT building_name_search FROM apartments ORDER BY id")
        ).scalars()
        stored = list(folded)
    engine.dispose()

    assert stored == ["edificio araraquara", "condominio sao joao"]


def test_offline_sql_lowercases_the_names(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://u:p@localhost/db")

    command.upgrade(alembic_config(), f"{BEFORE_SEARCH}:head", sql=True)

    sql = capsys.readouterr().out
    assert "SET building_name_search = lower(building_name)" in sql
    assert "ALTER COLUMN building_name_search SET NOT NULL" in sql
