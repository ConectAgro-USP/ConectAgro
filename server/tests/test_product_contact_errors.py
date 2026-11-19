from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.farmer import Farmer
from src.models.user import User
from tests.helpers import add_product, add_resident, add_user, login


def test_farmer_cannot_get_product_contact(
    client: TestClient, session: Session, farmer: Farmer, seller: Farmer
):
    own_product = add_product(session, farmer, name="Alface")
    other_product = add_product(session, seller, name="Couve")

    for product in (own_product, other_product):
        response = client.get(f"/api/products/{product.public_id}/contact")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.json() == {
            "detail": "Acesso permitido apenas para moradores e síndicos"
        }


@pytest.mark.parametrize("link_status", [LinkStatus.PENDENTE, LinkStatus.RECUSADO])
def test_unapproved_resident_cannot_get_product_contact(
    client: TestClient,
    session: Session,
    building: Apartment,
    seller: Farmer,
    link_status: LinkStatus,
):
    lettuce = add_product(session, seller)
    resident_user = add_user(session, "bia@example.com")
    resident = add_resident(session, building, resident_user)
    resident.link_status = link_status
    session.commit()
    login(client, resident_user)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.usefixtures("ana")
def test_user_without_profile_cannot_get_product_contact(
    client: TestClient, session: Session, seller: Farmer
):
    lettuce = add_product(session, seller)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_get_product_contact_requires_login(
    client: TestClient, session: Session, seller: Farmer
):
    lettuce = add_product(session, seller)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.usefixtures("building")
def test_get_contact_of_unknown_product_returns_404(client: TestClient, manager: User):
    login(client, manager)

    response = client.get(f"/api/products/{uuid4()}/contact")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Produto não encontrado"}


@pytest.mark.usefixtures("building")
def test_get_product_contact_rejects_invalid_id(client: TestClient, manager: User):
    login(client, manager)

    response = client.get("/api/products/abc/contact")

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["path", "public_id"]
