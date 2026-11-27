import pytest
from authlib.integrations.starlette_client import OAuthError
from fastapi.testclient import TestClient

from src.auth.oauth import oauth

GOOGLE_ERROR = "http://localhost:5173/login?error=google"


def fake_google_token(monkeypatch: pytest.MonkeyPatch, token) -> None:
    async def authorize_access_token(request):
        if isinstance(token, Exception):
            raise token
        return token

    monkeypatch.setattr(oauth.google, "authorize_access_token", authorize_access_token)


@pytest.mark.parametrize(
    "token",
    [
        {"access_token": "abc"},
        {"userinfo": None},
        {"userinfo": {}},
        {"userinfo": {"email_verified": True}},
        {"userinfo": {"email": None, "email_verified": True}},
        {"userinfo": {"email": 42, "email_verified": True}},
        {"userinfo": {"email": "", "email_verified": True}},
    ],
    ids=["sem-userinfo", "userinfo-nulo", "vazio", "sem-email", "email-nulo", "numero", "branco"],
)
def test_callback_without_account_data_goes_back_to_login(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, token: dict
):
    fake_google_token(monkeypatch, token)

    response = client.get("/api/auth/callback/google", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == GOOGLE_ERROR
    assert "access_token" not in response.cookies


def test_callback_with_oauth_error_goes_back_to_login(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    fake_google_token(monkeypatch, OAuthError(error="access_denied"))

    response = client.get("/api/auth/callback/google", follow_redirects=False)

    assert response.headers["location"] == GOOGLE_ERROR


def test_callback_with_unverified_email_goes_back_to_login(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    fake_google_token(monkeypatch, {"userinfo": {"email": "a@gmail.com", "email_verified": False}})

    response = client.get("/api/auth/callback/google", follow_redirects=False)

    assert response.headers["location"] == GOOGLE_ERROR
