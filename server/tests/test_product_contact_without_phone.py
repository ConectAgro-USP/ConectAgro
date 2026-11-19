from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.farmer import Farmer
from src.models.user import User
from tests.helpers import add_product, add_resident, add_user, login


def test_resident_gets_empty_cellphone_when_manager_has_no_phone(
    client: TestClient,
    session: Session,
    building: Apartment,
    manager: User,
    seller: Farmer,
):
    manager.name = "Carlos Almeida"
    manager.cellphone = None
    session.commit()

    lettuce = add_product(session, seller, name="Alface")
    resident_user = add_user(session, "bia@example.com", name="Beatriz Costa")
    resident = add_resident(session, building, resident_user)
    resident.link_status = LinkStatus.APROVADO
    session.commit()
    login(client, resident_user)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body["recipient_name"] == "Carlos Almeida"
    assert body["cellphone"] is None
    assert "Alface" in body["message"]
    assert "João Silva" in body["message"]


def test_resident_gets_empty_cellphone_when_manager_phone_is_empty(
    client: TestClient,
    session: Session,
    building: Apartment,
    manager: User,
    seller: Farmer,
):
    manager.cellphone = ""
    session.commit()

    lettuce = add_product(session, seller, name="Alface")
    resident_user = add_user(session, "bia@example.com")
    resident = add_resident(session, building, resident_user)
    resident.link_status = LinkStatus.APROVADO
    session.commit()
    login(client, resident_user)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["cellphone"] is None


def test_manager_gets_empty_cellphone_when_farmer_has_no_phone(
    client: TestClient,
    session: Session,
    building: Apartment,
    manager: User,
    seller: Farmer,
):
    seller.user.cellphone = None
    session.commit()

    lettuce = add_product(session, seller, name="Alface")
    login(client, manager)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body["recipient_name"] == "João Silva"
    assert body["cellphone"] is None
    assert "Alface" in body["message"]
    assert "João Silva" in body["message"]


def test_manager_gets_empty_cellphone_when_farmer_phone_is_empty(
    client: TestClient,
    session: Session,
    building: Apartment,
    manager: User,
    seller: Farmer,
):
    seller.user.cellphone = ""
    session.commit()

    lettuce = add_product(session, seller, name="Alface")
    login(client, manager)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["cellphone"] is None
