import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.purchase import PurchaseStatus
from src.models.review import Review
from tests.helpers import add_purchase_from
from tests.test_product_search import add_farmer_with_name, add_product

# a busca exige login, então todos os testes rodam com a Ana logada
pytestmark = pytest.mark.usefixtures("ana")


def test_search_lists_only_the_chosen_farmer_products(client: TestClient, session: Session):
    chosen = add_farmer_with_name(session, "chosen@example.com")
    other = add_farmer_with_name(session, "other@example.com")
    tomato = add_product(session, chosen, "Tomate")
    lettuce = add_product(session, chosen, "Alface")
    add_product(session, chosen, "Sem estoque", quantity=0)
    add_product(session, other, "Tomate")

    response = client.get("/api/products", params={"farmer_public_id": str(chosen.public_id)})
    with_query = client.get(
        "/api/products", params={"farmer_public_id": str(chosen.public_id), "q": "tomate"}
    )

    assert response.status_code == status.HTTP_200_OK
    assert {item["public_id"] for item in response.json()["items"]} == {
        str(tomato.public_id),
        str(lettuce.public_id),
    }
    assert response.json()["total"] == 2
    assert [item["public_id"] for item in with_query.json()["items"]] == [str(tomato.public_id)]


def test_search_by_unknown_or_invalid_farmer(client: TestClient, session: Session):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    add_product(session, farmer, "Tomate")

    unknown = client.get(
        "/api/products", params={"farmer_public_id": "00000000-0000-0000-0000-000000000000"}
    )
    invalid = client.get("/api/products", params={"farmer_public_id": "nao-e-um-id"})

    assert unknown.status_code == status.HTTP_200_OK
    assert unknown.json()["items"] == []
    assert unknown.json()["total"] == 0
    assert invalid.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_search_tells_the_farm_of_each_product(client: TestClient, session: Session):
    with_farm = add_farmer_with_name(session, "sitio@example.com")
    with_farm.farm_name = "Sítio Boa Vista"
    session.commit()
    without_farm = add_farmer_with_name(session, "sem-sitio@example.com")
    add_product(session, with_farm, "Tomate")
    add_product(session, without_farm, "Alface")

    response = client.get("/api/products")

    farms = {item["name"]: item["farmer_farm_name"] for item in response.json()["items"]}
    assert farms == {"Tomate": "Sítio Boa Vista", "Alface": None}


def test_search_tells_how_each_farmer_was_rated(
    client: TestClient, session: Session, building: Apartment, resident: Buyer
):
    rated = add_farmer_with_name(session, "avaliado@example.com")
    unrated = add_farmer_with_name(session, "novo@example.com")
    add_product(session, rated, "Tomate")
    add_product(session, unrated, "Alface")
    purchase = add_purchase_from(session, building.id, (rated, PurchaseStatus.ENTREGUE))
    second = add_purchase_from(session, building.id, (rated, PurchaseStatus.ENTREGUE))
    session.add(Review(rating=5, apartment=building, farmer=rated, purchase=purchase))
    session.add(Review(rating=4, buyer=resident, farmer=rated, purchase=purchase))
    session.add(Review(rating=4, apartment=building, farmer=rated, purchase=second))
    session.commit()

    response = client.get("/api/products")

    ratings = {
        item["name"]: (item["farmer_average_rating"], item["farmer_reviews_count"])
        for item in response.json()["items"]
    }
    assert ratings == {"Tomate": (4.33, 3), "Alface": (None, 0)}
