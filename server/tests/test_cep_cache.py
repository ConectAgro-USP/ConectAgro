import httpx
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.user import User
from tests.connectors.test_brasilapi import PAULISTA
from tests.helpers import add_user, login
from tests.test_profiles import FARMER, answer_cep

OTHER_CPF = "111.444.777-35"


def test_sign_ups_with_the_same_cep_ask_the_api_once(
    client: TestClient, session: Session, ana: User
):
    cep_requests = answer_cep(httpx.Response(200, json=PAULISTA))
    first = client.post("/api/profiles/farmer", json=FARMER)
    login(client, add_user(session, "bia@example.com"))

    second = client.post(
        "/api/profiles/farmer", json={**FARMER, "cpf": OTHER_CPF, "zip_code": "01310200"}
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_201_CREATED
    assert second.json()["farmer"]["zip_code"] == "01310200"
    assert len(cep_requests) == 1


def test_a_failed_cep_lookup_is_asked_again(client: TestClient, ana: User):
    answer_cep(httpx.Response(404, json={"type": "service_error"}))
    client.post("/api/profiles/farmer", json=FARMER)
    cep_requests = answer_cep(httpx.Response(200, json=PAULISTA))

    response = client.post("/api/profiles/farmer", json=FARMER)

    assert response.status_code == status.HTTP_201_CREATED
    assert len(cep_requests) == 1
