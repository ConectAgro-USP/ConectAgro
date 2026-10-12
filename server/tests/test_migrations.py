from pathlib import Path

import pytest
from sqlmodel import Session, create_engine, select

from alembic import command
from alembic.config import Config
from src.core.config import settings
from src.models import User

SERVER_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture()
def migrated_db_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    db_url = f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}"
    monkeypatch.setattr(settings, "DATABASE_URL", db_url)

    alembic_cfg = Config()
    alembic_cfg.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    command.upgrade(alembic_cfg, "head")

    return db_url


def test_migrated_schema_supports_user_lookup_by_email(migrated_db_url: str) -> None:
    engine = create_engine(migrated_db_url)

    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == "nobody@example.com")).first()
    engine.dispose()

    assert user is None
