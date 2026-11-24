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
NOT_NEEDED = "O produto {} não está nas necessidades do prédio"


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


def test_create_purchase_refuses_product_outside_the_building_needs(
    client: TestClient, session: Session, lettuce: Product
):
    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": NOT_NEEDED.format("Alface")}
    assert session.exec(select(Purchase)).all() == []
    assert stock_of(session, lettuce) == 10


def test_create_purchase_ignores_the_interest_of_a_pending_resident(
    client: TestClient, session: Session, building: Apartment, lettuce: Product
):
    pending = add_resident(session, building, add_user(session, "pendente@example.com"))
    add_interest(session, pending, lettuce)

    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": NOT_NEEDED.format("Alface")}


def test_create_purchase_ignores_the_interest_of_another_building(
    client: TestClient, session: Session, other_building: Apartment, lettuce: Product
):
    neighbour_user = add_user(session, "vizinho@example.com")
    neighbour = add_resident(
        session, other_building, neighbour_user, link_status=LinkStatus.APROVADO
    )
    add_interest(session, neighbour, lettuce)

    response = buy(client, lettuce)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": NOT_NEEDED.format("Alface")}


def test_create_purchase_buys_nothing_when_one_product_is_not_needed(
    client: TestClient, session: Session, resident: Buyer, lettuce: Product, potato: Product
):
    add_interest(session, resident, lettuce)

    response = buy(client, lettuce, potato)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": NOT_NEEDED.format("Batata")}
    assert session.exec(select(Purchase)).all() == []
    assert stock_of(session, lettuce) == 10
