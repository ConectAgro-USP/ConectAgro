from datetime import datetime, timedelta

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import Purchase
from src.models.user import User
from tests.helpers import add_farmer, add_interest, add_product, add_resident, add_user, login

FUTURE = datetime.now(BUSINESS_TZ).date() + timedelta(days=7)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


@pytest.fixture
def lettuce(session: Session) -> Product:
    joao = add_farmer(session, add_user(session, "joao@example.com"))
    return add_product(session, joao, name="Alface")


@pytest.fixture
def potato(session: Session) -> Product:
    maria = add_farmer(session, add_user(session, "maria@example.com"))
    return add_product(session, maria, name="Batata")


def buy(client: TestClient, *products: Product) -> Response:
    items = [
        {"product_public_id": str(product.public_id), "quantity": 2, "unit_price": "2.50"}
        for product in products
    ]
    payload = {"expected_delivery_date": FUTURE.isoformat(), "items": items}
    return client.post("/api/purchases", json=payload)


def stock_of(session: Session, product: Product) -> int:
    session.refresh(product)
    return product.quantity


def test_create_purchase_accepts_product_outside_the_building_needs(
    client: TestClient, session: Session, lettuce: Product
):
    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_201_CREATED
    assert len(session.exec(select(Purchase)).all()) == 1
    assert stock_of(session, lettuce) == 8


def test_create_purchase_accepts_product_wanted_only_by_a_pending_resident(
    client: TestClient, session: Session, building: Apartment, lettuce: Product
):
    pending = add_resident(session, building, add_user(session, "pendente@example.com"))
    add_interest(session, pending, lettuce)

    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_201_CREATED


def test_create_purchase_accepts_product_wanted_only_by_another_building(
    client: TestClient, session: Session, other_building: Apartment, lettuce: Product
):
    neighbour_user = add_user(session, "vizinho@example.com")
    neighbour = add_resident(
        session, other_building, neighbour_user, link_status=LinkStatus.APROVADO
    )
    add_interest(session, neighbour, lettuce)

    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_201_CREATED


def test_create_purchase_mixes_needed_and_not_needed_products(
    client: TestClient, session: Session, resident: Buyer, lettuce: Product, potato: Product
):
    add_interest(session, resident, lettuce)

    response = buy(client, lettuce, potato)

    assert response.status_code == status.HTTP_201_CREATED
    assert len(response.json()["purchase_parts"]) == 2
    assert stock_of(session, lettuce) == 8
    assert stock_of(session, potato) == 8


def test_purchase_outside_the_needs_leaves_the_needs_as_they_were(
    client: TestClient, session: Session, resident: Buyer, lettuce: Product, potato: Product
):
    add_interest(session, resident, potato)

    buy(client, lettuce)

    needs = client.get("/api/apartments/me/needs").json()["items"]
    assert [need["product"]["name"] for need in needs] == ["Batata"]


def test_only_the_manager_buys_for_the_building(
    client: TestClient, session: Session, resident: Buyer, lettuce: Product
):
    login(client, resident.user)

    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert session.exec(select(Purchase)).all() == []
    assert stock_of(session, lettuce) == 10
