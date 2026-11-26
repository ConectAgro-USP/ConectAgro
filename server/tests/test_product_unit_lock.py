import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product
from tests.helpers import add_interest, add_product, add_purchase, add_resident, add_user

LOCKED = "A unidade não pode mudar depois que o produto recebeu interesse ou foi vendido"


def wanted(session: Session, building: Apartment, product: Product) -> None:
    resident = add_resident(session, building, add_user(session, "bia@example.com"))
    add_interest(session, resident, product, quantity=3)


def sold(session: Session, building: Apartment, product: Product) -> None:
    add_purchase(session, building, (product, 5))


def patch(client: TestClient, product: Product, changes: dict):
    return client.patch(f"/api/products/{product.public_id}", json=changes)


@pytest.mark.parametrize("history", [wanted, sold], ids=["interesse", "venda"])
def test_unit_cannot_change_after_an_interest_or_a_sale(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment, history
):
    eggs = add_product(session, farmer, "Ovos")
    history(session, building, eggs)

    response = patch(client, eggs, {"unit": "duzia", "price": "9.00"})

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == LOCKED
    session.refresh(eggs)
    assert (eggs.unit, str(eggs.price)) == ("kg", "2.50")


@pytest.mark.parametrize("history", [wanted, sold], ids=["interesse", "venda"])
def test_other_fields_still_change_when_the_same_unit_is_sent(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment, history
):
    eggs = add_product(session, farmer, "Ovos")
    history(session, building, eggs)

    response = patch(client, eggs, {"unit": "kg", "price": "9.00"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["price"] == "9.00"
    assert response.json()["unit_locked"] is True


def test_unit_changes_while_nobody_wanted_or_bought_the_product(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    eggs = add_product(session, farmer, "Ovos")
    other = add_product(session, farmer, "Alface")
    wanted(session, building, other)

    response = patch(client, eggs, {"unit": "duzia"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["unit"] == "duzia"
    assert response.json()["unit_locked"] is False
