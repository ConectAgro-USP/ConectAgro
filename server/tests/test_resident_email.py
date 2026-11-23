import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.user import User
from tests.helpers import add_resident, add_user, login

URL = "/api/apartments/me/buyers"


def test_manager_sees_the_email_only_while_the_request_is_pending(
    client: TestClient, session: Session, manager: User, building: Apartment
):
    add_resident(session, building, add_user(session, "bia@example.com"), unit="11")
    caio = add_user(session, "caio@example.com")
    add_resident(session, building, caio, unit="12", link_status=LinkStatus.APROVADO)
    duda = add_user(session, "duda@example.com")
    add_resident(session, building, duda, unit="13", link_status=LinkStatus.RECUSADO)
    login(client, manager)

    residents = client.get(URL).json()

    emails = [resident["user"]["email"] for resident in residents]
    assert emails == ["bia@example.com", None, None]


@pytest.mark.parametrize("action", ["approve", "reject"])
def test_answer_to_a_request_no_longer_carries_the_email(
    client: TestClient, session: Session, manager: User, building: Apartment, action: str
):
    bia = add_user(session, "bia@example.com", name="Bia Lima")
    resident = add_resident(session, building, bia)
    login(client, manager)

    response = client.post(f"{URL}/{resident.public_id}/{action}")

    assert response.json()["user"] == {"name": "Bia Lima", "email": None}
    # o cadastro da moradora continua com o e-mail, só a resposta da API esconde
    session.refresh(bia)
    assert bia.email == "bia@example.com"
