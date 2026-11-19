from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.farmer import Farmer
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_resident, add_user, login


def test_approved_resident_gets_own_building_manager_contact(
    client: TestClient,
    session: Session,
    building: Apartment,
    other_building: Apartment,
    manager: User,
    seller: Farmer,
):
    manager.name = "Carlos Almeida"
    manager.cellphone = "11988887777"
    other_building.manager.name = "Roberto Lima"
    other_building.manager.cellphone = "11966665555"
    session.commit()

    lettuce = add_product(session, seller, name="Alface Crespa")
    resident_user = add_user(session, "bia@example.com", name="Beatriz Costa")
    resident = add_resident(session, building, resident_user)
    resident.link_status = LinkStatus.APROVADO
    session.commit()
    login(client, resident_user)

    response = client.get(f"/api/products/{lettuce.public_id}/contact")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body == {
        "recipient_name": "Carlos A.",
        "cellphone": "11988887777",
        "message": (
            "Olá, Carlos A.! Tenho interesse no produto "
            "Alface Crespa do agricultor João S."
        ),
    }
    assert "11966665555" not in response.text


def test_different_residents_get_their_own_building_manager_contact(
    client: TestClient,
    session: Session,
    building: Apartment,
    other_building: Apartment,
    manager: User,
    seller: Farmer,
):
    manager.name = "Carlos Almeida"
    manager.cellphone = "11988887777"
    other_building.manager.name = "Roberto Lima"
    other_building.manager.cellphone = "11966665555"
    session.commit()

    lettuce = add_product(session, seller, name="Alface Crespa")

    residents = [
        (building, "bia@example.com", "Carlos A.", "11988887777"),
        (other_building, "ana@example.com", "Roberto L.", "11966665555"),
    ]

    for apartment, email, expected_name, expected_cellphone in residents:
        resident_user = add_user(session, email)
        resident = add_resident(session, apartment, resident_user)
        resident.link_status = LinkStatus.APROVADO
        session.commit()

        login(client, resident_user)
        response = client.get(f"/api/products/{lettuce.public_id}/contact")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["recipient_name"] == expected_name
        assert body["cellphone"] == expected_cellphone


def test_manager_gets_product_farmer_contact(
    client: TestClient, session: Session, building: Apartment, manager: User
):
    farmer_user = add_user(session, "maria@example.com", name="Maria Souza")
    farmer_user.cellphone = "11977776666"
    session.commit()
    maria = add_farmer(session, farmer_user)
    potato = add_product(session, maria, name="Batata Orgânica")
    login(client, manager)

    response = client.get(f"/api/products/{potato.public_id}/contact")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "recipient_name": "Maria S.",
        "cellphone": "11977776666",
        "message": "Olá, Maria S.! Tenho interesse no seu produto Batata Orgânica.",
    }


def test_manager_gets_contact_of_correct_farmer_for_each_product(
    client: TestClient,
    session: Session,
    building: Apartment,
    manager: User,
):
    farmers = [
        ("maria@example.com", "Maria Souza", "Maria S.", "11977776666", "Batata Orgânica"),
        ("joao@example.com", "João Santos", "João S.", "11955554444", "Tomate"),
    ]

    products = []
    for email, name, shown_name, cellphone, product_name in farmers:
        farmer_user = add_user(session, email, name=name)
        farmer_user.cellphone = cellphone
        session.commit()

        farmer = add_farmer(session, farmer_user)
        products.append(
            (add_product(session, farmer, name=product_name), shown_name, cellphone)
        )

    login(client, manager)

    for product, expected_name, expected_cellphone in products:
        response = client.get(f"/api/products/{product.public_id}/contact")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["recipient_name"] == expected_name
        assert body["cellphone"] == expected_cellphone
