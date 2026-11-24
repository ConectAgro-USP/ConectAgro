from collections.abc import Generator

import pytest
from fastapi import APIRouter, status
from fastapi.testclient import TestClient

from src.main import app
from src.models.user import User

broken = APIRouter()


@broken.get("/api/teste/quebrada")
def broken_route():
    raise RuntimeError("segredo interno")


@pytest.fixture
def quiet_client() -> Generator[TestClient, None, None]:
    app.include_router(broken)
    try:
        with TestClient(app, raise_server_exceptions=False) as test_client:
            yield test_client
    finally:
        app.router.routes[:] = [route for route in app.router.routes if route not in broken.routes]


def test_unknown_api_path_answers_404_in_portuguese(client: TestClient):
    response = client.get("/api/nao-existe")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Recurso não encontrado"}


def test_wrong_method_answers_405_in_portuguese_and_keeps_allow(client: TestClient):
    response = client.delete("/api/health")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert response.json() == {"detail": "Método não permitido"}
    assert response.headers["allow"] == "GET"


def test_route_messages_are_kept(client: TestClient, ana: User):
    response = client.post("/api/apartments/me/buyers/6f1c2b9e-3d4a-4e5f-8a7b-9c0d1e2f3a4b/approve")

    assert response.json() == {"detail": "Acesso permitido apenas para síndicos"}


def test_missing_login_keeps_its_own_message(client: TestClient):
    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {"detail": "Não autenticado"}


def test_unexpected_error_answers_500_in_portuguese(quiet_client: TestClient):
    response = quiet_client.get("/api/teste/quebrada")

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.json() == {"detail": "Algo deu errado no servidor. Tente novamente mais tarde"}
    assert "segredo" not in response.text
