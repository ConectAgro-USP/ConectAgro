import httpx
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.user import User
from tests.connectors.test_brasilapi import PAULISTA
from tests.geo import PAULISTA_POINT, PRACA_DA_SE, point_of
from tests.helpers import add_farmer, add_user, login
from tests.profiles import answer_cep

SEARCH_5KM = {"max_distance_km": 5}


def test_search_uses_the_saved_coordinates_without_the_brasilapi(
    client: TestClient, session: Session, manager: User, building: Apartment
):
    building.latitude, building.longitude = PAULISTA_POINT
    farmer = add_farmer(session, add_user(session, "carlos@example.com", name="Carlos Souza"))
    farmer.latitude, farmer.longitude = PRACA_DA_SE
    session.commit()
    cep_requests = answer_cep(httpx.Response(500))
    login(client, manager)

    response = client.get("/api/farmers", params=SEARCH_5KM)

    assert response.status_code == status.HTTP_200_OK
    # em linha reta entre a Avenida Paulista e a Praça da Sé
    assert [item["distance_km"] for item in response.json()["items"]] == [0.45]
    assert cep_requests == []


def test_search_saves_the_building_coordinates_it_looks_up(
    client: TestClient, session: Session, manager: User, building: Apartment
):
    # o prédio tem o CEP 01310200, mas nenhuma coordenada salva
    farmer = add_farmer(session, add_user(session, "carlos@example.com", name="Carlos Souza"))
    farmer.latitude, farmer.longitude = PAULISTA_POINT
    session.commit()
    cep_requests = answer_cep(httpx.Response(200, json=PAULISTA))
    login(client, manager)

    first = client.get("/api/farmers", params=SEARCH_5KM)
    first_lookups = [request.url.path for request in cep_requests]
    cep_requests.clear()
    second = client.get("/api/farmers", params=SEARCH_5KM)

    assert first_lookups == ["/api/cep/v2/01310200"]
    assert cep_requests == []
    assert second.json() == first.json()
    assert [item["distance_km"] for item in second.json()["items"]] == [0.0]
    session.refresh(building)
    assert point_of(building) == PAULISTA_POINT
