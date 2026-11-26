import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.user import User
from tests.helpers import ITAU_CNPJ, add_building, add_product, add_purchase, add_user, login
from tests.queries import counted_queries
from tests.sales import SALES_URL, sales_of


@pytest.fixture
def lettuce(session: Session, joao: Farmer) -> Product:
    return add_product(session, joao, name="Alface")


def test_sale_brings_the_delivery_address_and_the_manager_contact(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    joao: Farmer,
    lettuce: Product,
):
    building.address = "Avenida Paulista, 1000"
    manager.name, manager.cellphone = "Carla Mendes", "11987654321"
    session.commit()
    add_purchase(session, building, (lettuce, 2))

    [sale] = sales_of(client, joao)

    assert sale["delivery_address"] == "Avenida Paulista, 1000"
    assert sale["delivery_zip_code"] == "01310200"
    assert sale["manager_name"] == "Carla Mendes"
    assert sale["manager_cellphone"] == "11987654321"


def test_sale_without_address_or_cellphone_brings_them_as_null(
    client: TestClient, session: Session, building: Apartment, joao: Farmer, lettuce: Product
):
    add_purchase(session, building, (lettuce, 2))

    [sale] = sales_of(client, joao)

    assert sale["delivery_address"] is None
    assert sale["delivery_zip_code"] == "01310200"
    assert sale["manager_cellphone"] is None


def test_farmer_outside_the_purchase_never_receives_its_contact(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    joao: Farmer,
    maria: Farmer,
    lettuce: Product,
):
    manager.cellphone = "11987654321"
    session.commit()
    add_purchase(session, building, (lettuce, 2))

    login(client, maria.user)
    response = client.get(SALES_URL)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["items"] == []
    assert "11987654321" not in response.text


def test_sales_load_the_contacts_without_one_query_per_sale(
    client: TestClient, session: Session, building: Apartment, joao: Farmer, lettuce: Product
):
    add_purchase(session, building, (lettuce, 1))
    login(client, joao.user)
    with counted_queries(session) as one_sale:
        client.get(SALES_URL)
    for number, cnpj in enumerate([ITAU_CNPJ, "11222333000181"]):
        other_manager = add_user(session, f"sindico{number}@example.com")
        other = add_building(session, other_manager, name=f"Edifício {number}", cnpj=cnpj)
        add_purchase(session, other, (lettuce, 1))

    with counted_queries(session) as three_sales:
        body = client.get(SALES_URL).json()

    assert len(body["items"]) == 3
    assert len(three_sales) == len(one_sale)
