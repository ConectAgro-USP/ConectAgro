import pytest
from fastapi.testclient import TestClient

from src.core.config import Settings, settings


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "commit": ""}


def test_health_shows_the_published_commit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "RENDER_GIT_COMMIT", "70e6beb1ecc35f19c82a079d800c670c33eeca7e")

    response = client.get("/api/health")

    assert response.json() == {
        "status": "ok",
        "commit": "70e6beb1ecc35f19c82a079d800c670c33eeca7e",
    }


def test_settings_read_the_commit_from_render(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abc123")

    assert Settings().RENDER_GIT_COMMIT == "abc123"
