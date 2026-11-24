from datetime import datetime, timedelta

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.product import BUSINESS_TZ, Product
from src.models.user import User
from tests.helpers import add_farmer, add_interest, add_product, add_user, login

FUTURE = datetime.now(BUSINESS_TZ).date() + timedelta(days=7)


@pytest.fixture
def lettuce(session: Session, resident: Buyer) -> Product:
    joao = add_farmer(session, add_user(session, "joao@example.com"))
    lettuce = add_product(session, joao, name="Alface")
    add_interest(session, resident, lettuce, quantity=3)
    return lettuce


@pytest.fixture
def purchase(client: TestClient, manager: User, building: Apartment, lettuce: Product) -> dict:
    login(client, manager)
    item = {"product_public_id": str(lettuce.public_id), "quantity": 3, "unit_price": "2.50"}
    payload = {"expected_delivery_date": FUTURE.isoformat(), "items": [item]}
    return client.post("/api/purchases", json=payload).json()


def close_part(client: TestClient, product: Product, purchase: dict, new_status: str) -> None:
    login(client, product.farmer.user)
    url = f"/api/purchases/{purchase['public_id']}/parts/me/status"
    assert client.patch(url, json={"status": new_status}).status_code == status.HTTP_200_OK


def needs(client: TestClient, manager: User) -> dict[str, int]:
    login(client, manager)
    rows = client.get("/api/apartments/me/needs").json()
    return {row["product"]["name"]: row["total_quantity"] for row in rows}


def my_purchase(client: TestClient, resident: Buyer) -> dict | None:
    login(client, resident.user)
    [interest] = client.get("/api/interests/me").json()
    return interest["purchase"]


def test_resident_follows_the_purchase_of_the_interest(
    client: TestClient, resident: Buyer, purchase: dict
):
    linked = my_purchase(client, resident)

    assert linked == {
        "public_id": purchase["public_id"],
        "created_at": purchase["created_at"],
        "expected_delivery_date": FUTURE.isoformat(),
        "status": "EM PROGRESSO",
        "closed_at": None,
    }


def test_delivered_interest_shows_the_delivery_and_stays_out_of_the_needs(
    client: TestClient, manager: User, resident: Buyer, lettuce: Product, purchase: dict
):
    close_part(client, lettuce, purchase, "ENTREGUE")

    linked = my_purchase(client, resident)

    assert linked["status"] == "ENTREGUE"
    assert linked["closed_at"] is not None
    assert needs(client, manager) == {}


def test_part_cancelled_by_the_farmer_brings_the_need_back(
    client: TestClient, manager: User, resident: Buyer, lettuce: Product, purchase: dict
):
    close_part(client, lettuce, purchase, "CANCELADA")

    assert needs(client, manager) == {"Alface": 3}
    assert my_purchase(client, resident) is None


def test_purchase_cancelled_by_the_manager_brings_the_need_back(
    client: TestClient, manager: User, resident: Buyer, purchase: dict
):
    assert needs(client, manager) == {}

    client.post(f"/api/purchases/{purchase['public_id']}/cancel")

    assert needs(client, manager) == {"Alface": 3}
    assert my_purchase(client, resident) is None


def test_new_purchase_takes_the_interest_back_from_a_cancelled_part(
    client: TestClient, manager: User, resident: Buyer, lettuce: Product, purchase: dict
):
    client.post(f"/api/purchases/{purchase['public_id']}/cancel")
    item = {"product_public_id": str(lettuce.public_id), "quantity": 3, "unit_price": "2.50"}
    payload = {"expected_delivery_date": FUTURE.isoformat(), "items": [item]}
    again = client.post("/api/purchases", json=payload).json()

    assert my_purchase(client, resident)["public_id"] == again["public_id"]


def test_new_purchase_leaves_a_delivered_interest_with_its_delivery(
    client: TestClient, manager: User, resident: Buyer, lettuce: Product, purchase: dict
):
    close_part(client, lettuce, purchase, "ENTREGUE")
    login(client, manager)
    item = {"product_public_id": str(lettuce.public_id), "quantity": 1, "unit_price": "2.50"}
    payload = {"expected_delivery_date": FUTURE.isoformat(), "items": [item]}
    client.post("/api/purchases", json=payload)

    assert my_purchase(client, resident)["public_id"] == purchase["public_id"]


def test_linking_the_interest_keeps_its_edit_date(
    client: TestClient, resident: Buyer, purchase: dict
):
    login(client, resident.user)
    [interest] = client.get("/api/interests/me").json()

    assert interest["updated_at"] is None


def test_resident_sees_the_summary_but_not_the_purchase_itself(
    client: TestClient, resident: Buyer, purchase: dict
):
    login(client, resident.user)

    response = client.get(f"/api/purchases/{purchase['public_id']}")

    assert response.status_code == status.HTTP_403_FORBIDDEN
