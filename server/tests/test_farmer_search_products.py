from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_user, login

YESTERDAY = datetime.now(BUSINESS_TZ).date() - timedelta(days=1)
HIDDEN_FROM_CATALOG = {
    "pausado": {"is_available": False},
    "esgotado": {"quantity": 0},
    "vencido": {"expiration_date": YESTERDAY},
}


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


@pytest.fixture
def carlos(session: Session) -> Farmer:
    return add_farmer(session, add_user(session, "carlos@example.com", name="Carlos Silva"))


@pytest.mark.parametrize("overrides", HIDDEN_FROM_CATALOG.values(), ids=HIDDEN_FROM_CATALOG)
def test_products_filter_ignores_products_out_of_the_catalog(
    client: TestClient, session: Session, carlos: Farmer, overrides: dict
):
    add_product(session, carlos, "Morango", **overrides)

    response = client.get("/api/farmers", params={"products": ["morango"]})

    assert response.json()["total"] == 0


@pytest.mark.parametrize("overrides", HIDDEN_FROM_CATALOG.values(), ids=HIDDEN_FROM_CATALOG)
def test_products_count_ignores_products_out_of_the_catalog(
    client: TestClient, session: Session, carlos: Farmer, overrides: dict
):
    add_product(session, carlos, "Morango", **overrides)
    add_product(session, carlos, "Alface")

    response = client.get("/api/farmers")

    assert response.json()["items"][0]["available_products_count"] == 1


def test_products_filter_matches_a_visible_product_next_to_a_paused_one(
    client: TestClient, session: Session, carlos: Farmer
):
    add_product(session, carlos, "Morango Pausado", is_available=False)
    add_product(session, carlos, "Morango Doce")

    response = client.get("/api/farmers", params={"products": ["morango"]})

    assert response.json()["total"] == 1
    assert response.json()["items"][0]["available_products_count"] == 1
