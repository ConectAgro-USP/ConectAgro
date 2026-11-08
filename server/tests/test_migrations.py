from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine, select

from alembic import command
from src.core.config import settings
from src.models import User

SERVER_DIR = Path(__file__).resolve().parent.parent


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    return config


@pytest.fixture()
def db_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    return url


@pytest.fixture()
def migrated_db_url(db_url: str) -> str:
    command.upgrade(alembic_config(), "head")
    return db_url


def test_migrated_schema_supports_user_lookup_by_email(migrated_db_url: str) -> None:
    engine = create_engine(migrated_db_url)

    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == "nobody@example.com")).first()
    engine.dispose()

    assert user is None


@pytest.mark.usefixtures("migrated_db_url")
def test_migrations_match_models() -> None:
    command.check(alembic_config())


def test_upgrade_lowercases_emails_except_case_collisions(db_url: str) -> None:
    emails = ["Cintia@Gmail.com", "CINTIA@Gmail.com", "Bia@Gmail.com"]
    command.upgrade(alembic_config(), "08fbf5974c61")
    engine = create_engine(db_url)
    with engine.begin() as connection:
        # SQL cru, porque o model User descreve o schema do head, não o da 08fbf5974c61
        connection.execute(
            text(
                "INSERT INTO users (email, name, created_at) "
                "VALUES (:email, 'Conta', CURRENT_TIMESTAMP)"
            ),
            [{"email": email} for email in emails],
        )

    command.upgrade(alembic_config(), "head")

    with engine.connect() as connection:
        stored = connection.execute(text("SELECT email FROM users ORDER BY id")).scalars().all()
    engine.dispose()

    assert stored == ["Cintia@Gmail.com", "CINTIA@Gmail.com", "bia@gmail.com"]


def test_upgrade_fills_link_requested_at_of_existing_buyers(db_url: str) -> None:
    command.upgrade(alembic_config(), "3d12241f5496")
    engine = create_engine(db_url)
    with engine.begin() as connection:
        # SQL cru: o model Buyer já tem as colunas do head
        connection.execute(
            text(
                "INSERT INTO users (email, name, created_at) "
                "VALUES ('ana@example.com', 'Ana', CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO buyers (public_id, user_id, unit, link_status) "
                "VALUES (:public_id, 1, '42', 'PENDENTE')"
            ),
            {"public_id": uuid4().hex},
        )

    command.upgrade(alembic_config(), "head")

    with engine.connect() as connection:
        requested_at = connection.execute(text("SELECT link_requested_at FROM buyers")).scalar()
    engine.dispose()

    assert requested_at is not None


@pytest.mark.parametrize("table", ["users", "products"])
def test_created_at_becomes_timestamptz_on_postgres(
    table: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://u:p@localhost/db")

    command.upgrade(alembic_config(), "2a098413a71f:08fbf5974c61", sql=True)

    assert (
        f"ALTER TABLE {table} ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE "
        "USING created_at AT TIME ZONE 'UTC'"
    ) in capsys.readouterr().out
    assert SQLModel.metadata.tables[table].c.created_at.type.timezone


def test_migrations_accept_percent_encoded_password(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://u:p%40ss@localhost/db")

    command.upgrade(alembic_config(), "head", sql=True)

    assert "CREATE TABLE users" in capsys.readouterr().out


def test_purchase_parts_migration_on_postgres(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://u:p@localhost/db")

    command.upgrade(alembic_config(), "165a46c43d78:e0ed8ac0498c", sql=True)

    sql = capsys.readouterr().out
    assert "CREATE TYPE purchasestatus" not in sql
    assert "status purchasestatus NOT NULL" in sql
    assert "PRIMARY KEY (purchase_part_id, product_id)" in sql
    assert "closed_at TIMESTAMP WITH TIME ZONE" in sql
