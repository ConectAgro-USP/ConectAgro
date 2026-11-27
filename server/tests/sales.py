from fastapi import status
from fastapi.testclient import TestClient

from src.models.farmer import Farmer
from tests.helpers import login

SALES_URL = "/api/farmers/me/sales"


def sales_of(client: TestClient, farmer: Farmer) -> list[dict]:
    login(client, farmer.user)
    response = client.get(SALES_URL)
    assert response.status_code == status.HTTP_200_OK
    return response.json()["items"]
