from datetime import datetime, timedelta

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.buyer import Buyer
from src.models.interest import Interest
from src.models.product import BUSINESS_TZ
from tests.helpers import add_farmer, add_product, add_user, login

TODAY = datetime.now(BUSINESS_TZ).date()


def register_interest(
    client: TestClient, session: Session, resident: Buyer, **overrides
) -> Response:
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    product = add_product(session, farmer, **overrides)
    login(client, resident.user)
    payload = {"product_public_id": str(product.public_id), "quantity": 1}
    return client.post("/api/interests", json=payload)


@pytest.mark.parametrize(
    "overrides",
    [{"expiration_date": TODAY - timedelta(days=1)}, {"is_available": False}, {"quantity": 0}],
    ids=["vencido", "indisponivel", "sem-estoque"],
)
def test_create_interest_refuses_product_outside_the_catalog(
    client: TestClient, session: Session, resident: Buyer, overrides: dict
):
    response = register_interest(client, session, resident, **overrides)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": "Este produto não está mais disponível no catálogo"}
    assert session.exec(select(Interest)).all() == []


def test_create_interest_accepts_product_that_expires_today(
    client: TestClient, session: Session, resident: Buyer
):
    response = register_interest(client, session, resident, expiration_date=TODAY)

    assert response.status_code == status.HTTP_201_CREATED
