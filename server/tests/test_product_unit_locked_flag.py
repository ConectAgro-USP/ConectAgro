from datetime import datetime, timedelta

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ
from tests.helpers import add_product
from tests.pictures import upload
from tests.queries import counted_queries
from tests.unit_history import sold, wanted


def my_products(client: TestClient) -> dict[str, bool]:
    response = client.get("/api/products/me")
    assert response.status_code == status.HTTP_200_OK
    return {item["name"]: item["unit_locked"] for item in response.json()["items"]}


def test_my_products_say_which_units_are_locked(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    sold(session, building, add_product(session, farmer, "Ovos"))
    wanted(session, building, add_product(session, farmer, "Mel"))
    add_product(session, farmer, "Alface")

    assert my_products(client) == {"Ovos": True, "Mel": True, "Alface": False}


def test_my_products_check_the_locks_in_one_query_for_the_whole_page(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    add_product(session, farmer, "Alface")
    with counted_queries(session) as few:
        my_products(client)
    for index in range(5):
        sold(session, building, add_product(session, farmer, f"Produto {index}"))

    with counted_queries(session) as many:
        locks = my_products(client)

    assert len(many) == len(few)
    assert sum(locks.values()) == 5


def test_a_new_product_starts_with_the_unit_free(client: TestClient, farmer: Farmer):
    expiration = datetime.now(BUSINESS_TZ).date() + timedelta(days=10)
    payload = {
        "name": "Ovos",
        "quantity": 5,
        "price": "9.00",
        "expiration_date": expiration.isoformat(),
    }

    response = client.post("/api/products", json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["unit_locked"] is False


def test_picture_upload_answers_with_the_lock_of_the_unit(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    eggs = add_product(session, farmer, "Ovos")
    lettuce = add_product(session, farmer, "Alface")
    sold(session, building, eggs)

    assert upload(client, eggs).json()["unit_locked"] is True
    assert upload(client, lettuce).json()["unit_locked"] is False


def test_other_people_never_see_the_lock_of_the_unit(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    eggs = add_product(session, farmer, "Ovos")

    detail = client.get(f"/api/products/{eggs.public_id}").json()
    catalog = client.get("/api/products").json()["items"]

    assert "unit_locked" not in detail
    assert "unit_locked" not in catalog[0]
