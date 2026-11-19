import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_resident, add_user, login


@pytest.mark.usefixtures("building")
def test_manager_does_not_see_email_saved_as_farmer_name(
    client: TestClient, session: Session, manager: User
):
    # sem o nome do Google, o cadastro guarda o e-mail no lugar do nome
    farmer_user = add_user(session, "maria@example.com", name="maria@example.com")
    potato = add_product(session, add_farmer(session, farmer_user), name="Batata")
    login(client, manager)

    response = client.get(f"/api/products/{potato.public_id}/contact")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "recipient_name": "",
        "cellphone": None,
        "message": "Olá! Tenho interesse no seu produto Batata.",
    }


def test_resident_does_not_see_emails_saved_as_names(
    client: TestClient, session: Session, building: Apartment, manager: User
):
    manager.name = "sindico@example.com"
    session.commit()
    farmer_user = add_user(session, "maria@example.com", name="maria@example.com")
    potato = add_product(session, add_farmer(session, farmer_user), name="Batata")
    resident_user = add_user(session, "bia@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)
    login(client, resident_user)

    response = client.get(f"/api/products/{potato.public_id}/contact")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "recipient_name": "",
        "cellphone": None,
        "message": "Olá! Tenho interesse no produto Batata.",
    }
