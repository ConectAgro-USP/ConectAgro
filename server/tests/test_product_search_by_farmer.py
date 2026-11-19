import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

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
