from datetime import datetime, timedelta

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.interest import Interest
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import Purchase
from src.models.user import User
from tests.helpers import add_farmer, add_interest, add_product, add_resident, add_user, login

FUTURE = datetime.now(BUSINESS_TZ).date() + timedelta(days=7)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


@pytest.fixture
def lettuce(session: Session, resident: Buyer) -> Product:
    joao = add_farmer(session, add_user(session, "joao@example.com"))
    lettuce = add_product(session, joao, name="Alface")
    add_interest(session, resident, lettuce, quantity=3)
    return lettuce


def buy(client: TestClient, product: Product, quantity: int = 2) -> Response:
    item = {"product_public_id": str(product.public_id), "quantity": quantity, "unit_price": "2.50"}
    payload = {"expected_delivery_date": FUTURE.isoformat(), "items": [item]}
    return client.post("/api/purchases", json=payload)


def needs(client: TestClient) -> list[str]:
    return [need["product"]["name"] for need in client.get("/api/apartments/me/needs").json()]


def test_purchase_clears_the_bought_product_from_the_needs(
    client: TestClient, session: Session, building: Apartment, resident: Buyer, lettuce: Product
):
    potato = add_product(session, lettuce.farmer, name="Batata")
    add_interest(session, resident, potato)
    neighbour_user = add_user(session, "vizinha@example.com")
    neighbour = add_resident(session, building, neighbour_user, link_status=LinkStatus.APROVADO)
    add_interest(session, neighbour, lettuce, quantity=7)

    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_201_CREATED
    assert needs(client) == ["Batata"]
    login(client, resident.user)
    mine = client.get("/api/interests/me").json()
    assert [interest["product_name"] for interest in mine] == ["Batata"]


def test_purchase_keeps_interests_outside_the_building_needs(
    client: TestClient,
    session: Session,
    building: Apartment,
    other_building: Apartment,
    lettuce: Product,
):
    pending = add_resident(session, building, add_user(session, "pendente@example.com"))
    outsider_user = add_user(session, "vizinho@example.com")
    outsider = add_resident(session, other_building, outsider_user, link_status=LinkStatus.APROVADO)
    add_interest(session, pending, lettuce)
    add_interest(session, outsider, lettuce)

    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_201_CREATED
    kept = session.exec(select(Interest.buyer_id)).all()
    assert sorted(kept) == sorted([pending.id, outsider.id])


def test_refused_purchase_keeps_the_interests(client: TestClient, lettuce: Product):
    response = buy(client, lettuce, quantity=11)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert needs(client) == ["Alface"]


def test_bought_product_needs_a_new_interest_to_be_bought_again(
    client: TestClient, session: Session, lettuce: Product
):
    buy(client, lettuce)

    again = buy(client, lettuce)

    assert again.status_code == status.HTTP_409_CONFLICT
    assert again.json() == {"detail": "O produto Alface não está nas necessidades do prédio"}
    assert len(session.exec(select(Purchase)).all()) == 1


def test_cancelled_purchase_does_not_bring_the_interests_back(
    client: TestClient, lettuce: Product
):
    purchase = buy(client, lettuce).json()

    response = client.post(f"/api/purchases/{purchase['public_id']}/cancel")

    assert response.status_code == status.HTTP_200_OK
    assert needs(client) == []
