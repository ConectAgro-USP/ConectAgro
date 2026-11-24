from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product, ProductUnit
from src.models.user import User
from tests.helpers import add_product, add_purchase, login


def item_units(sale_or_purchase: dict) -> dict[str, str]:
    return {item["product_name"]: item["product_unit"] for item in sale_or_purchase}


def products_by_unit(session: Session, farmer: Farmer) -> list[Product]:
    eggs = add_product(session, farmer, name="Ovos", unit=ProductUnit.DUZIA)
    kale = add_product(session, farmer, name="Couve", unit=ProductUnit.MACO)
    milk = add_product(session, farmer, name="Leite", unit=ProductUnit.LITRO)
    potato = add_product(session, farmer, name="Batata")
    return [eggs, kale, milk, potato]


def test_sales_history_items_carry_the_product_unit(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    products = products_by_unit(session, farmer)
    add_purchase(session, building, *[(product, 2) for product in products])

    response = client.get("/api/farmers/me/sales")

    assert response.status_code == status.HTTP_200_OK
    [sale] = response.json()["items"]
    assert item_units(sale["purchase_products"]) == {
        "Ovos": "duzia",
        "Couve": "maco",
        "Leite": "litro",
        "Batata": "kg",
    }


def test_building_purchase_items_carry_the_product_unit(
    client: TestClient, session: Session, joao: Farmer, building: Apartment, manager: User
):
    add_purchase(session, building, *[(product, 1) for product in products_by_unit(session, joao)])
    login(client, manager)

    response = client.get("/api/apartments/me/purchases")

    assert response.status_code == status.HTTP_200_OK
    [purchase] = response.json()["items"]
    [part] = purchase["purchase_parts"]
    assert item_units(part["purchase_products"]) == {
        "Ovos": "duzia",
        "Couve": "maco",
        "Leite": "litro",
        "Batata": "kg",
    }
