from datetime import datetime, timedelta

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product, ProductUnit
from src.models.purchase import Purchase
from src.models.user import User
from tests.helpers import add_product, login

FUTURE = datetime.now(BUSINESS_TZ).date() + timedelta(days=7)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


@pytest.fixture
def eggs(session: Session, joao: Farmer) -> Product:
    # o agricultor trocou kg por dúzia depois que o carrinho abriu
    return add_product(session, joao, name="Ovos", unit=ProductUnit.DUZIA)


def buy(client: TestClient, product: Product, **unit: str) -> Response:
    item = {"product_public_id": str(product.public_id), "quantity": 2, "unit_price": "2.50"}
    payload = {"expected_delivery_date": FUTURE.isoformat(), "items": [{**item, **unit}]}
    return client.post("/api/purchases", json=payload)


def test_purchase_refuses_a_unit_unlike_the_cart(
    client: TestClient, session: Session, eggs: Product
):
    response = buy(client, eggs, unit="kg")

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "detail": "A unidade do produto Ovos mudou. Confira o carrinho antes de confirmar"
    }
    assert session.exec(select(Purchase)).all() == []
    session.refresh(eggs)
    assert eggs.quantity == 10


def test_purchase_accepts_the_unit_the_cart_showed(
    client: TestClient, session: Session, eggs: Product
):
    response = buy(client, eggs, unit="duzia")

    assert response.status_code == status.HTTP_201_CREATED
    session.refresh(eggs)
    assert eggs.quantity == 8


def test_purchase_without_the_unit_keeps_working(client: TestClient, eggs: Product):
    response = buy(client, eggs)

    assert response.status_code == status.HTTP_201_CREATED


def test_purchase_refuses_an_unknown_unit(client: TestClient, session: Session, eggs: Product):
    response = buy(client, eggs, unit="saco")

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert session.exec(select(Purchase)).all() == []
