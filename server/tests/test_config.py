from src.core.config import Settings


def test_render_database_url_uses_psycopg_driver() -> None:
    settings = Settings(DATABASE_URL="postgresql://user:pass@host/db")

    assert settings.DATABASE_URL == "postgresql+psycopg://user:pass@host/db"
