from datetime import UTC, datetime

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.user import User
from tests.helpers import add_resident, add_user, login

LONG_AGO = datetime(2020, 1, 1, tzinfo=UTC)


def add_pending_resident(session: Session, building: Apartment) -> tuple[User, Buyer]:
    user = add_user(session, "morador@example.com", name="Bia Lima")
    resident = add_resident(session, building, user, unit="11")
    resident.link_requested_at = LONG_AGO
    session.commit()
    return user, resident


def pending_units(client: TestClient, manager: User) -> list[str]:
    login(client, manager)
    response = client.get("/api/apartments/me/buyers", params={"status": "PENDENTE"})
    return [resident["unit"] for resident in response.json()["items"]]


def test_pending_resident_switches_the_request_to_another_building(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    other_building: Apartment,
):
    user, resident = add_pending_resident(session, building)
    login(client, user)
    new_link = {"apartment_public_id": str(other_building.public_id), "block": "B", "unit": "22"}

    response = client.patch("/api/profiles/me", json=new_link)

    assert response.status_code == status.HTTP_200_OK
    buyer = response.json()["buyer"]
    assert buyer["apartment"]["public_id"] == str(other_building.public_id)
    assert (buyer["block"], buyer["unit"]) == ("B", "22")
    assert buyer["link_status"] == "PENDENTE"
    assert buyer["link_reviewed_at"] is None
    requested_at = datetime.fromisoformat(buyer["link_requested_at"])
    assert requested_at.replace(tzinfo=requested_at.tzinfo or UTC) > LONG_AGO
    assert buyer["public_id"] == str(resident.public_id)


def test_old_building_loses_the_request_and_the_new_one_gets_it(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    other_building: Apartment,
):
    user, _ = add_pending_resident(session, building)
    login(client, user)
    client.patch("/api/profiles/me", json={"apartment_public_id": str(other_building.public_id)})

    assert pending_units(client, manager) == []
    assert pending_units(client, other_building.manager) == ["11"]


def test_pending_resident_still_cannot_use_the_building_after_the_switch(
    client: TestClient,
    session: Session,
    building: Apartment,
    other_building: Apartment,
):
    user, _ = add_pending_resident(session, building)
    login(client, user)
    client.patch("/api/profiles/me", json={"apartment_public_id": str(other_building.public_id)})

    response = client.get("/api/interests/me")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "aguardando aprovação" in response.json()["detail"]


def test_switch_to_unknown_building_keeps_the_pending_request(
    client: TestClient, session: Session, manager: User, building: Apartment
):
    user, resident = add_pending_resident(session, building)
    login(client, user)
    unknown = "6f1c2b9e-3d4a-4e5f-8a7b-9c0d1e2f3a4b"

    response = client.patch("/api/profiles/me", json={"apartment_public_id": unknown})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json() == {"detail": "Prédio não encontrado"}
    assert pending_units(client, manager) == ["11"]
