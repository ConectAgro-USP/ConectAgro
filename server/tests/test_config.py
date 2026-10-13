import pytest
from pydantic import ValidationError

from src.core.config import Settings


@pytest.mark.parametrize("scheme", ["postgresql", "postgres"])
def test_render_database_url_uses_psycopg_driver(scheme: str) -> None:
    settings = Settings(DATABASE_URL=f"{scheme}://user:pass@host/db")

    assert settings.DATABASE_URL == "postgresql+psycopg://user:pass@host/db"


@pytest.mark.parametrize(
    "unsafe",
    [
        {"SESSION_SECRET_KEY": "x" * 31},
        {"JWT_SECRET_KEY": "x" * 31},
        {"APP_FLAVOR": "production"},
        {"BACKEND_CORS_ORIGINS": "*"},
    ],
)
def test_settings_rejects_unsafe_values(unsafe: dict[str, str]) -> None:
    with pytest.raises(ValidationError):
        Settings(**unsafe)


def test_app_flavor_defaults_to_prod(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APP_FLAVOR", raising=False)

    assert Settings().is_prod


@pytest.mark.parametrize(
    "overrides, expected",
    [
        ({"BACKEND_CORS_ORIGINS": "http://a.com/, http://b.com"}, ["http://a.com", "http://b.com"]),
        ({"FRONTEND_URL": "http://localhost:8000/"}, ["http://localhost:8000"]),
    ],
)
def test_cors_origins_ignore_trailing_slash(overrides: dict[str, str], expected: list[str]) -> None:
    assert Settings(**{"BACKEND_CORS_ORIGINS": "", **overrides}).cors_origins == expected
