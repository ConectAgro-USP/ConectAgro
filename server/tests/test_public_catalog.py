from decimal import Decimal

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.product import ProductUnit
from tests.helpers import add_product


def test_visitor_sees_the_catalog_without_a_session(
    client: TestClient, session: Session, seller: Farmer
):
    add_product(session, seller, "Alface")
    add_product(session, seller, "Couve")

    response = client.get("/api/products")

    assert response.status_code == status.HTTP_200_OK
    names = sorted(item["name"] for item in response.json()["items"])
    assert names == ["Alface", "Couve"]


def test_visitor_searches_filters_and_sorts(
    client: TestClient, session: Session, seller: Farmer
):
    add_product(session, seller, "Alface crespa", price=Decimal("4.00"))
    add_product(session, seller, "Alface roxa", price=Decimal("2.00"))
    add_product(session, seller, "Alface americana", quantity=1)
    add_product(session, seller, "Couve")
    params = {"q": "alface", "min_quantity": 5, "sort": "lowest_price"}

    response = client.get("/api/products", params=params)

    assert response.status_code == status.HTTP_200_OK
    names = [item["name"] for item in response.json()["items"]]
    assert names == ["Alface roxa", "Alface crespa"]


def test_visitor_catalog_leaves_owner_fields_out(
    client: TestClient, session: Session, seller: Farmer
):
    add_product(session, seller, unit=ProductUnit.KG)

    item = client.get("/api/products").json()["items"][0]

    assert "unit_locked" not in item
    assert "farmer_id" not in item
    assert "id" not in item


def test_visitor_opens_a_product_page(client: TestClient, session: Session, seller: Farmer):
    lettuce = add_product(session, seller, description="Colhida hoje")

    response = client.get(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["name"] == "Alface"
    assert body["description"] == "Colhida hoje"
    assert body["farmer"]["public_id"] == str(seller.public_id)
    assert "unit_locked" not in body
    assert "farmer_id" not in body
    assert set(body["farmer"]) == {"public_id", "farm_name", "short_name", "picture_url"}
