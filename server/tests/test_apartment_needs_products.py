from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.buyer import Buyer
from src.models.user import User
from tests.helpers import add_farmer, add_interest, add_product, add_user, login


def needs_of(client: TestClient, manager: User) -> list[str]:
    login(client, manager)
    response = client.get("/api/apartments/me/needs")
    assert response.status_code == status.HTTP_200_OK
    return [need["product"]["name"] for need in response.json()]


def test_apartment_needs_leaves_out_a_removed_product(
    client: TestClient, session: Session, manager: User, resident: Buyer
):
    farmer_user = add_user(session, "farmer@example.com")
    farmer = add_farmer(session, farmer_user)
    add_interest(session, resident, add_product(session, farmer, name="Fica"))
    removed = add_product(session, farmer, name="Removido")
    add_interest(session, resident, removed)
    login(client, farmer_user)

    response = client.delete(f"/api/products/{removed.public_id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert needs_of(client, manager) == ["Fica"]


def test_apartment_needs_leaves_out_an_unavailable_product(
    client: TestClient, session: Session, manager: User, resident: Buyer
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    add_interest(session, resident, add_product(session, farmer, name="Fica"))
    hidden = add_product(session, farmer, name="Indisponível", is_available=False)
    add_interest(session, resident, hidden)

    assert needs_of(client, manager) == ["Fica"]
