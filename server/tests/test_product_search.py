from fastapi import status
from fastapi.testclient import TestClient


def test_product_search_endpoint_is_registered_and_not_implemented(client: TestClient):
    response = client.get(
        "/api/products",
        params={
            "q": "café",
            "expiration_from": "2026-11-05",
            "min_quantity": 2,
            "sort": "lowest_price",
            "page": 2,
        },
    )

    assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
    assert response.json() == {"detail": "A busca de produtos ainda não foi implementada"}


def test_product_search_rejects_invalid_pagination_and_quantity(client: TestClient):
    response = client.get("/api/products", params={"page": 0, "min_quantity": 0})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
