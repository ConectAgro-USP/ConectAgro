import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.purchase import PurchaseStatus
from src.models.review import Review
from src.models.user import User
from tests.connectors.test_brasilapi import PAULISTA
from tests.geo import PRACA_DA_SE, km_north
from tests.helpers import add_farmer, add_purchase_from, add_user, login
from tests.test_profiles import answer_cep

# coordenadas que a BrasilAPI dá na resposta PAULISTA
PAULISTA_POINT = (-23.5475, -46.63611)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User) -> None:
    login(client, manager)


def add_farmer_at(session: Session, name: str, km: float | None) -> Farmer:
    email = f"{name.lower()}@example.com"
    farmer = add_farmer(session, add_user(session, email, name=f"{name} Souza"))
    if km is not None:
        farmer.latitude, farmer.longitude = km_north(km)
    session.commit()
    return farmer


def rate(session: Session, building: Apartment, farmer: Farmer, rating: int) -> None:
    purchase = add_purchase_from(session, building.id, (farmer, PurchaseStatus.ENTREGUE))
    session.add(
        Review(
            farmer_id=farmer.id,
            apartment_id=building.id,
            purchase_id=purchase.id,
            rating=rating,
        )
    )
    session.commit()


def locate(session: Session, building: Apartment) -> None:
    building.latitude, building.longitude = PRACA_DA_SE
    session.commit()


def names(response) -> list[str]:
    return [item["name"] for item in response.json()["items"]]


def test_sort_by_distance_puts_the_nearest_first(
    client: TestClient, session: Session, building: Apartment
):
    locate(session, building)
    far = add_farmer_at(session, "Longe", km=8)
    rate(session, building, far, 5)
    add_farmer_at(session, "Antigo", km=None)
    add_farmer_at(session, "Perto", km=1.2)
    add_farmer_at(session, "Meio", km=3)

    response = client.get("/api/farmers", params={"sort": "distance"})

    assert response.status_code == status.HTTP_200_OK
    assert names(response) == ["Perto S.", "Meio S.", "Longe S.", "Antigo S."]
    distances = [item["distance_km"] for item in response.json()["items"]]
    assert distances == [1.2, 3.0, 8.0, None]


def test_sort_by_distance_breaks_ties_by_reputation(
    client: TestClient, session: Session, building: Apartment
):
    locate(session, building)
    low = add_farmer_at(session, "Baixa", km=2)
    high = add_farmer_at(session, "Alta", km=2)
    rate(session, building, low, 2)
    rate(session, building, high, 5)

    response = client.get("/api/farmers", params={"sort": "distance"})

    assert names(response) == ["Alta S.", "Baixa S."]


def test_default_sort_keeps_the_reputation_first(
    client: TestClient, session: Session, building: Apartment
):
    locate(session, building)
    add_farmer_at(session, "Perto", km=1)
    far = add_farmer_at(session, "Longe", km=9)
    rate(session, building, far, 4)

    default = client.get("/api/farmers")
    explicit = client.get("/api/farmers", params={"sort": "reputation"})

    assert names(default) == ["Longe S.", "Perto S."]
    assert explicit.json() == default.json()


def test_distance_comes_without_a_radius(client: TestClient, session: Session, building: Apartment):
    locate(session, building)
    add_farmer_at(session, "Perto", km=2.5)
    add_farmer_at(session, "Antigo", km=None)
    cep_requests = answer_cep(httpx.Response(500))

    response = client.get("/api/farmers")

    distances = {item["name"]: item["distance_km"] for item in response.json()["items"]}
    assert distances == {"Perto S.": 2.5, "Antigo S.": None}
    assert cep_requests == []


def test_sort_by_distance_looks_up_the_building_once(
    client: TestClient, session: Session, building: Apartment
):
    add_farmer_at(session, "Perto", km=1)
    cep_requests = answer_cep(httpx.Response(200, json=PAULISTA))

    response = client.get("/api/farmers", params={"sort": "distance"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["items"][0]["distance_km"] is not None
    assert len(cep_requests) == 1
    session.refresh(building)
    assert (building.latitude, building.longitude) == PAULISTA_POINT


def test_sort_by_distance_rejects_a_building_that_cannot_be_located(
    client: TestClient, building: Apartment
):
    answer_cep(httpx.Response(404, json={"message": "CEP não encontrado"}))

    response = client.get("/api/farmers", params={"sort": "distance"})

    assert response.status_code == status.HTTP_409_CONFLICT


def test_search_rejects_an_unknown_sort(client: TestClient, building: Apartment):
    response = client.get("/api/farmers", params={"sort": "price"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
