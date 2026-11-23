from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import Purchase
from src.models.user import User
from tests.helpers import add_farmer, add_interest, add_product, add_user, login

FUTURE = datetime.now(BUSINESS_TZ).date() + timedelta(days=7)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


@pytest.fixture
def lettuce(session: Session, resident: Buyer) -> Product:
    joao = add_farmer(session, add_user(session, "joao@example.com"))
    return add_interest(session, resident, add_product(session, joao, name="Alface")).product


def item(product: Product, unit_price: str = "2.50") -> dict:
    return {"product_public_id": str(product.public_id), "quantity": 2, "unit_price": unit_price}


def buy(client: TestClient, *items: dict) -> Response:
    payload = {"expected_delivery_date": FUTURE.isoformat(), "items": list(items)}
    return client.post("/api/purchases", json=payload)


def stock_of(session: Session, product: Product) -> int:
    session.refresh(product)
    return product.quantity


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"is_available": False}, "O produto Couve está indisponível e não pode ser comprado"),
        ({"price": Decimal("3.00")}, "O preço do produto Couve mudou, confira o resumo da compra"),
    ],
    ids=["indisponivel", "preco-mudou"],
)
def test_create_purchase_refuses_product_unlike_the_summary(
    client: TestClient, session: Session, lettuce: Product, overrides: dict, message: str
):
    kale = add_product(session, lettuce.farmer, name="Couve", **overrides)

    response = buy(client, item(lettuce), item(kale))

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": message}
    assert session.exec(select(Purchase)).all() == []
    assert stock_of(session, lettuce) == 10
    assert stock_of(session, kale) == 10


def test_create_purchase_accepts_the_same_price_written_differently(
    client: TestClient, session: Session, lettuce: Product
):
    response = buy(client, item(lettuce, unit_price="2.5"))

    assert response.status_code == status.HTTP_201_CREATED
    [part] = response.json()["purchase_parts"]
    assert part["purchase_products"][0]["unit_price"] == "2.50"
    assert stock_of(session, lettuce) == 8


def test_create_purchase_requires_the_unit_price(
    client: TestClient, session: Session, lettuce: Product
):
    response = buy(client, {"product_public_id": str(lettuce.public_id), "quantity": 2})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert session.exec(select(Purchase)).all() == []
