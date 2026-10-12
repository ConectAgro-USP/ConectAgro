from fastapi import status
from fastapi.responses import RedirectResponse
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.auth.oauth import oauth
from src.models.user import User

user_sign_in = {
  'name': "Cintia",
  'email': "cintia@gmail.com",
  'password': "#NHJgrej4",
  'zip_code': "01000-000"
}

user_login = {
  "email": "cintia@gmail.com",
  "password": "#NHJgrej4",
}


def test_register(client: TestClient):
    response = client.post("/api/auth/register", json = user_sign_in)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["message"] == "Conta criada com sucesso"


def test_register_duplicate_email(client: TestClient):
    client.post("/api/auth/register", json = user_sign_in)
    
    user_repeated_email = user_sign_in.copy()
    user_repeated_email['name'] = "Arminda"
    user_repeated_email['password'] = "re$-$f56fd"
    user_repeated_email['zip_code'] = "01980-066"
    
    response = client.post("/api/auth/register", json = user_repeated_email)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "E-mail já cadastrado" in response.json()["detail"]


def test_register_short_email(client: TestClient):
    user_short_email = user_sign_in.copy()
    user_short_email['email'] = "c@g.com"
    response = client.post("/api/auth/register", json = user_short_email)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_login_success(client: TestClient):
    client.post("/api/auth/register", json = user_sign_in)
    response = client.post("/api/auth/login", json = user_login)

    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.cookies


def test_login_wrong_password(client: TestClient):
    client.post("/api/auth/register", json = user_sign_in)

    user_wrong_password = user_login.copy()
    user_wrong_password['password'] = "123456"

    response = client.post("/api/auth/login", json = user_wrong_password)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "E-mail ou senha incorretos" in response.json()["detail"]


def test_login_google_uses_frontend_callback(client: TestClient, monkeypatch):
    redirect_uris = []

    async def fake_authorize_redirect(request, redirect_uri):
        redirect_uris.append(redirect_uri)
        return RedirectResponse("https://accounts.google.com")

    monkeypatch.setattr(oauth.google, "authorize_redirect", fake_authorize_redirect)

    client.get("/api/auth/login/google", follow_redirects=False)

    assert redirect_uris == ["http://localhost:5173/api/auth/callback/google"]


def test_login_google_account_without_password(client: TestClient, session: Session):
    session.add(User(email="google@gmail.com", name="Conta Google"))
    session.commit()

    response = client.post(
        "/api/auth/login", json = {"email": "google@gmail.com", "password": "qualquer-senha"}
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "E-mail ou senha incorretos" in response.json()["detail"]


def test_me_returns_logged_user(client: TestClient):
    client.post("/api/auth/register", json = user_sign_in)
    client.post("/api/auth/login", json = user_login)

    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == "cintia@gmail.com"


def test_me_without_cookie(client: TestClient):
    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
