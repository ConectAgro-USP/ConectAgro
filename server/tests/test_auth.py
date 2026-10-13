import asyncio
import threading
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.core.config import settings
from src.main import app
from src.models.user import User
from src.services.auth_service import AuthService
from src.services.exceptions import InvalidCredentialsError

signup_payload = {"name": "Cintia", "email": "cintia@gmail.com", "password": "#NHJgrej4"}
login_payload = {"email": "cintia@gmail.com", "password": "#NHJgrej4"}

IN_ONE_HOUR = datetime.now(UTC) + timedelta(hours=1)
OTHER_KEY = "outra-chave-com-pelo-menos-32-caracteres"


def signed_token(payload: dict, key: str = settings.JWT_SECRET_KEY) -> str:
    return jwt.encode(payload, key, algorithm=settings.JWT_ALGORITHM)


def test_register(client: TestClient):
    response = client.post("/api/auth/register", json=signup_payload)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == {"message": "Conta criada com sucesso", "user_id": 1}


def test_register_duplicate_email(client: TestClient):
    client.post("/api/auth/register", json=signup_payload)

    duplicate = {**signup_payload, "name": "Arminda", "password": "re$-$f56fd"}
    response = client.post("/api/auth/register", json=duplicate)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "E-mail já cadastrado" in response.json()["detail"]


@pytest.mark.parametrize("email", ["c@g", "aaaaaaaa", "isto nao e email"])
def test_register_invalid_email(client: TestClient, email: str):
    response = client.post("/api/auth/register", json={**signup_payload, "email": email})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.parametrize(
    "field, value", [("name", "A"), ("name", "     "), ("password", "1234567")]
)
def test_register_rejects_short_fields(client: TestClient, field: str, value: str):
    response = client.post("/api/auth/register", json={**signup_payload, field: value})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.parametrize("name", ["Ana", "João"])
def test_register_accepts_short_real_names(client: TestClient, name: str):
    response = client.post("/api/auth/register", json={**signup_payload, "name": name})

    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.parametrize(
    "path, payload",
    [
        ("/api/auth/register", {**signup_payload, "password": "x" * 129}),
        ("/api/auth/register", {**signup_payload, "name": "A" * 101}),
        ("/api/auth/login", {**login_payload, "password": "x" * 129}),
    ],
    ids=["senha-cadastro", "nome", "senha-login"],
)
def test_rejects_oversized_fields(client: TestClient, path: str, payload: dict):
    response = client.post(path, json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_email_is_case_insensitive(client: TestClient):
    client.post("/api/auth/register", json={**signup_payload, "email": " Cintia@Gmail.com "})

    duplicate = client.post("/api/auth/register", json=signup_payload)
    login = client.post("/api/auth/login", json={**login_payload, "email": "CINTIA@gmail.com"})

    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST
    assert login.status_code == status.HTTP_200_OK


def test_login_success(client: TestClient):
    client.post("/api/auth/register", json=signup_payload)
    response = client.post("/api/auth/login", json=login_payload)

    assert response.json() == {"message": "Login realizado com sucesso"}
    assert "access_token" in response.cookies


def test_login_cookie_attributes(client: TestClient):
    client.post("/api/auth/register", json=signup_payload)

    cookie = client.post("/api/auth/login", json=login_payload).headers["set-cookie"]

    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert f"Max-Age={settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}" in cookie


def test_login_cookie_is_secure_in_prod(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "APP_FLAVOR", "prod")
    client.post("/api/auth/register", json=signup_payload)

    response = client.post("/api/auth/login", json=login_payload)

    assert "Secure" in response.headers["set-cookie"]


def test_login_wrong_password(client: TestClient):
    client.post("/api/auth/register", json=signup_payload)

    response = client.post("/api/auth/login", json={**login_payload, "password": "123456"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "E-mail ou senha incorretos" in response.json()["detail"]


def test_login_google_account_without_password(client: TestClient, session: Session):
    session.add(User(email="google@gmail.com", name="Conta Google"))
    session.commit()

    response = client.post(
        "/api/auth/login", json={"email": "google@gmail.com", "password": "qualquer-senha"}
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "E-mail ou senha incorretos" in response.json()["detail"]


@pytest.mark.anyio
async def test_concurrent_logins_do_not_block_each_other(monkeypatch: pytest.MonkeyPatch):
    barrier = threading.Barrier(2, timeout=5)

    def authenticate_together(self, email, password):
        barrier.wait()  # só passa se os dois logins rodarem ao mesmo tempo, em threads
        raise InvalidCredentialsError

    monkeypatch.setattr(AuthService, "authenticate", authenticate_together)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        responses = await asyncio.gather(
            *(client.post("/api/auth/login", json=login_payload) for _ in range(2))
        )

    assert [response.status_code for response in responses] == [status.HTTP_401_UNAUTHORIZED] * 2


def test_me_returns_logged_user(client: TestClient):
    other = {**signup_payload, "name": "Arminda", "email": "arminda@gmail.com"}
    client.post("/api/auth/register", json=signup_payload)
    client.post("/api/auth/register", json=other)
    client.post("/api/auth/login", json=other)

    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == "arminda@gmail.com"


def test_me_does_not_expose_password_hash(client: TestClient):
    client.post("/api/auth/register", json=signup_payload)
    client.post("/api/auth/login", json=login_payload)

    assert "hashed_password" not in client.get("/api/auth/me").json()


def test_me_without_cookie(client: TestClient):
    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize(
    "token",
    [
        "nao-e-um-jwt",
        signed_token({"sub": "1", "exp": IN_ONE_HOUR}, key=OTHER_KEY),
        signed_token({"sub": "1", "exp": datetime.now(UTC) - timedelta(minutes=1)}),
        signed_token({"sub": "999", "exp": IN_ONE_HOUR}),
        signed_token({"sub": "1"}),
        signed_token({"exp": IN_ONE_HOUR}),
        signed_token({"sub": "abc", "exp": IN_ONE_HOUR}),
    ],
    ids=[
        "malformado",
        "assinatura-invalida",
        "expirado",
        "usuario-inexistente",
        "sem-exp",
        "sem-sub",
        "sub-nao-numerico",
    ],
)
def test_me_rejects_invalid_token(client: TestClient, token: str):
    # com o usuário 1 cadastrado, o 401 dos tokens com sub 1 só pode vir da validação do JWT
    client.post("/api/auth/register", json=signup_payload)
    client.cookies.set("access_token", token)

    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout_ends_session(client: TestClient):
    client.post("/api/auth/register", json=signup_payload)
    client.post("/api/auth/login", json=login_payload)

    response = client.post("/api/auth/logout")

    assert "HttpOnly" in response.headers["set-cookie"]
    assert client.get("/api/auth/me").status_code == status.HTTP_401_UNAUTHORIZED
