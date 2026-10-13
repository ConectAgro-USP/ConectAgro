import pytest
from fastapi.responses import RedirectResponse
from fastapi.testclient import TestClient

from src.auth.oauth import oauth


def fake_google_userinfo(monkeypatch: pytest.MonkeyPatch, **userinfo) -> None:
    async def authorize_access_token(request):
        return {"userinfo": userinfo}

    monkeypatch.setattr(oauth.google, "authorize_access_token", authorize_access_token)


def test_login_google_uses_frontend_callback(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    redirect_uris = []

    async def fake_authorize_redirect(request, redirect_uri):
        redirect_uris.append(redirect_uri)
        return RedirectResponse("https://accounts.google.com")

    monkeypatch.setattr(oauth.google, "authorize_redirect", fake_authorize_redirect)

    client.get("/api/auth/login/google", follow_redirects=False)

    assert redirect_uris == ["http://localhost:5173/api/auth/callback/google"]


def test_google_callback_without_name_uses_email(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    fake_google_userinfo(monkeypatch, email="google@gmail.com", email_verified=True)

    response = client.get("/api/auth/callback/google", follow_redirects=False)

    assert response.headers["location"] == "http://localhost:5173"
    assert client.get("/api/auth/me").json()["name"] == "google@gmail.com"


@pytest.mark.parametrize(
    "email, claims",
    [("cintia@gmail.com", {}), ("cintia@empresa.com.br", {"hd": "empresa.com.br"})],
    ids=["gmail", "workspace"],
)
def test_google_callback_links_password_account_and_disables_password(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, email: str, claims: dict[str, str]
):
    credentials = {"email": email, "password": "#NHJgrej4"}
    registered = client.post("/api/auth/register", json={"name": "Cintia", **credentials})
    assert registered.status_code == 201
    # maiúsculas de propósito, pois o vínculo só acontece se o callback normalizar o e-mail
    fake_google_userinfo(monkeypatch, email=email.upper(), email_verified=True, **claims)

    response = client.get("/api/auth/callback/google", follow_redirects=False)

    assert response.headers["location"] == "http://localhost:5173"
    assert client.get("/api/auth/me").json()["email"] == email
    assert client.post("/api/auth/login", json=credentials).status_code == 401


def test_google_callback_keeps_password_account_outside_gmail_and_workspace(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    credentials = {"email": "maria@empresa.com.br", "password": "#NHJgrej4"}
    client.post("/api/auth/register", json={"name": "Maria", **credentials})
    fake_google_userinfo(monkeypatch, email="maria@empresa.com.br", email_verified=True)

    response = client.get("/api/auth/callback/google", follow_redirects=False)

    assert response.headers["location"] == "http://localhost:5173/login?error=google"
    assert client.post("/api/auth/login", json=credentials).status_code == 200


@pytest.mark.parametrize(
    "query", ["error=access_denied", "code=abc&state=sem-sessao"], ids=["cancelado", "state"]
)
def test_google_callback_redirects_to_login_on_oauth_error(client: TestClient, query: str):
    response = client.get(f"/api/auth/callback/google?{query}", follow_redirects=False)

    assert response.headers["location"] == "http://localhost:5173/login?error=google"
    assert "access_token" not in response.cookies
