from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.core.security import create_access_token
from src.models.user import User
from tests.helpers import add_user, login


def test_old_token_stops_working_after_logout(client: TestClient, session: Session):
    user = add_user(session, "ana@example.com")
    login(client, user)
    old_token = client.cookies.get("access_token")

    response = client.post("/api/auth/logout")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"ok": True}
    client.cookies.set("access_token", old_token)
    assert client.get("/api/auth/me").status_code == status.HTTP_401_UNAUTHORIZED
    session.refresh(user)
    assert user.session_version == 1


def test_logout_ends_the_other_devices_too(client: TestClient, session: Session):
    user = add_user(session, "ana@example.com")
    other_device = create_access_token(user.id, user.session_version)
    login(client, user)

    client.post("/api/auth/logout")

    client.cookies.set("access_token", other_device)
    assert client.get("/api/auth/me").status_code == status.HTTP_401_UNAUTHORIZED


def test_new_login_after_logout_works(client: TestClient):
    credentials = {"email": "cintia@gmail.com", "password": "#NHJgrej4"}
    client.post("/api/auth/register", json={"name": "Cintia", **credentials})
    client.post("/api/auth/login", json=credentials)
    client.post("/api/auth/logout")

    client.post("/api/auth/login", json=credentials)

    assert client.get("/api/auth/me").status_code == status.HTTP_200_OK


def test_logout_without_session_only_clears_the_cookie(client: TestClient):
    response = client.post("/api/auth/logout")

    assert response.status_code == status.HTTP_200_OK
    assert 'access_token=""' in response.headers["set-cookie"]


def test_logout_with_invalid_token_changes_nobody(client: TestClient, session: Session, ana: User):
    client.cookies.set("access_token", "nao-e-um-jwt")

    response = client.post("/api/auth/logout")

    session.refresh(ana)
    assert response.status_code == status.HTTP_200_OK
    assert ana.session_version == 0
