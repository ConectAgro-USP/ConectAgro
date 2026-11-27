import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.user import User
from tests.connectors.test_brasilapi import PAULISTA
from tests.geo import km_north, locate
from tests.helpers import add_farmer, add_user, login
from tests.profiles import answer_cep

SEARCH_5KM = {"max_distance_km": 5}
WITHOUT_COORDINATES = {**PAULISTA, "location": {"type": "Point", "coordinates": {}}}
BUILDING_NOT_LOCATED = (
    "Não foi possível localizar o CEP do prédio para calcular as distâncias. "
    "O síndico deve revisar o CEP em Meu perfil"
)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User) -> None:
    login(client, manager)


def add_farmer_at(session: Session, email: str, km: float | None) -> None:
    farmer = add_farmer(session, add_user(session, email, name="Carlos Souza"))
    if km is not None:
        farmer.latitude, farmer.longitude = km_north(km)
    session.commit()


def test_radius_search_leaves_out_farmers_without_coordinates(
    client: TestClient, session: Session, building: Apartment
):
    locate(session, building)
    add_farmer_at(session, "perto@example.com", km=2)
    add_farmer_at(session, "antigo@example.com", km=None)
    cep_requests = answer_cep(httpx.Response(500))

    response = client.get("/api/farmers", params=SEARCH_5KM)

    assert response.status_code == status.HTTP_200_OK
    assert [item["distance_km"] for item in response.json()["items"]] == [2.0]
    assert cep_requests == []


def test_radius_search_leaves_out_farmers_beyond_the_radius(
    client: TestClient, session: Session, building: Apartment
):
    locate(session, building)
    add_farmer_at(session, "perto@example.com", km=4.9)
    add_farmer_at(session, "longe@example.com", km=5.1)

    response = client.get("/api/farmers", params=SEARCH_5KM)

    assert [item["distance_km"] for item in response.json()["items"]] == [4.9]


@pytest.mark.parametrize(
    "answer",
    [
        httpx.Response(200, json=WITHOUT_COORDINATES),
        httpx.Response(404, json={"message": "CEP não encontrado"}),
        httpx.Response(400, json={"message": "CEP inválido"}),
    ],
    ids=["sem-coordenadas", "nao-encontrado", "invalido"],
)
def test_radius_search_rejects_a_building_that_cannot_be_located(
    client: TestClient, session: Session, building: Apartment, answer: httpx.Response
):
    add_farmer_at(session, "perto@example.com", km=1)
    cep_requests = answer_cep(answer)

    response = client.get("/api/farmers", params=SEARCH_5KM)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": BUILDING_NOT_LOCATED}
    assert len(cep_requests) == 1
    session.refresh(building)
    assert building.latitude is None


def test_radius_search_reports_the_brasilapi_down(
    client: TestClient, session: Session, building: Apartment
):
    answer_cep(httpx.Response(500))

    response = client.get("/api/farmers", params=SEARCH_5KM)

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_search_without_radius_never_calls_the_brasilapi(
    client: TestClient, session: Session, building: Apartment
):
    add_farmer_at(session, "perto@example.com", km=1)
    cep_requests = answer_cep(httpx.Response(500))

    response = client.get("/api/farmers")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["total"] == 1
    assert cep_requests == []
