import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.interest import Interest
from src.models.product import Product, ProductUnit
from tests.helpers import add_interest, add_product, login

UNIT_CHANGED = {"detail": "A unidade do produto mudou. Confira a página antes de continuar"}


@pytest.fixture(autouse=True)
def logged_resident(client: TestClient, resident: Buyer) -> None:
    login(client, resident.user)


@pytest.fixture
def eggs(session: Session, joao: Farmer) -> Product:
    return add_product(session, joao, name="Ovos", unit=ProductUnit.DUZIA)


def want(client: TestClient, product: Product, **unit: str) -> Response:
    payload = {"product_public_id": str(product.public_id), "quantity": 3, **unit}
    return client.post("/api/interests", json=payload)


def change(client: TestClient, interest: Interest, payload: dict) -> Response:
    return client.patch(f"/api/interests/{interest.public_id}", json=payload)


def test_interest_refuses_a_unit_unlike_the_page(
    client: TestClient, session: Session, eggs: Product
):
    response = want(client, eggs, unit="kg")

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == UNIT_CHANGED
    assert session.exec(select(Interest)).all() == []


@pytest.mark.parametrize("unit", [{"unit": "duzia"}, {}], ids=["mesma-unidade", "sem-unidade"])
def test_interest_accepts_the_same_unit_or_none(client: TestClient, eggs: Product, unit: dict):
    response = want(client, eggs, **unit)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["quantity"] == 3


def test_interest_update_refuses_a_unit_unlike_the_page(
    client: TestClient, session: Session, resident: Buyer, eggs: Product
):
    interest = add_interest(session, resident, eggs)

    response = change(client, interest, {"quantity": 5, "unit": "kg"})

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == UNIT_CHANGED
    session.refresh(interest)
    assert interest.quantity == 1


@pytest.mark.parametrize(
    "payload",
    [{"quantity": 5, "unit": "duzia"}, {"quantity": 5}],
    ids=["mesma-unidade", "sem-unidade"],
)
def test_interest_update_accepts_the_same_unit_or_none(
    client: TestClient, session: Session, resident: Buyer, eggs: Product, payload: dict
):
    interest = add_interest(session, resident, eggs)

    response = change(client, interest, payload)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["quantity"] == 5


def test_interest_update_refuses_a_null_unit(
    client: TestClient, session: Session, resident: Buyer, eggs: Product
):
    interest = add_interest(session, resident, eggs)

    response = change(client, interest, {"quantity": 5, "unit": None})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
