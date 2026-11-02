from datetime import UTC, datetime

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.buyer import LinkStatus
from tests.helpers import (
    add_building,
    add_farmer,
    add_resident,
    add_user,
    login,
)

UNKNOWN_ID = "6f1c2b9e-3d4a-4e5f-8a7b-9c0d1e2f3a4b"


def test_list_apartments_returns_name_cep_and_public_id(client: TestClient, session: Session):
    bauru = add_building(session, add_user(session, "bauru@example.com"), name="Edifício Bauru")
    araraquara = add_building(session, add_user(session, "araraquara@example.com"))
    login(client, add_user(session, "ana@example.com"))

    response = client.get("/api/apartments")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == [
        {
            "public_id": str(araraquara.public_id),
            "building_name": "Edifício Araraquara",
            "zip_code": "01310200",
        },
        {
            "public_id": str(bauru.public_id),
            "building_name": "Edifício Bauru",
            "zip_code": "01310200",
        },
    ]


def test_manager_lists_residents_by_status(client: TestClient, session: Session):
    bia = add_user(session, "bia@example.com", name="Bia Lima")
    manager = add_user(session, "sindico@example.com")
    building = add_building(session, manager)
    other_building = add_building(
        session, add_user(session, "outro@example.com"), name="Edifício Bauru"
    )
    pending = add_resident(session, building, bia, unit="11")
    caio = add_user(session, "caio@example.com", name="Caio Lima")
    add_resident(session, building, caio, unit="12", link_status=LinkStatus.APROVADO)
    add_resident(session, other_building, add_user(session, "duda@example.com"), unit="13")
    login(client, manager)

    response = client.get("/api/apartments/me/buyers", params={"status": "PENDENTE"})

    residents = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert len(residents) == 1
    assert residents[0]["public_id"] == str(pending.public_id)
    assert residents[0]["user"] == {"name": "Bia Lima"}
    assert residents[0]["unit"] == "11"
    assert residents[0]["link_status"] == "PENDENTE"
    assert residents[0]["link_requested_at"] is not None


def test_manager_lists_every_resident_without_status(client: TestClient, session: Session):
    manager = add_user(session, "sindico@example.com")
    building = add_building(session, manager)
    other_building = add_building(
        session, add_user(session, "outro@example.com"), name="Edifício Bauru"
    )
    add_resident(session, building, add_user(session, "bia@example.com"), unit="11")
    caio = add_user(session, "caio@example.com")
    add_resident(session, building, caio, unit="12", link_status=LinkStatus.APROVADO)
    add_resident(session, other_building, add_user(session, "duda@example.com"), unit="13")
    login(client, manager)

    response = client.get("/api/apartments/me/buyers")

    residents = response.json()
    assert len(residents) == 2
    assert residents[0]["unit"] == "11"
    assert residents[1]["unit"] == "12"


def test_residents_are_listed_from_the_oldest_request(client: TestClient, session: Session):
    manager = add_user(session, "sindico@example.com")
    building = add_building(session, manager)
    newer = add_resident(session, building, add_user(session, "bia@example.com"), unit="11")
    older = add_resident(session, building, add_user(session, "caio@example.com"), unit="12")
    newer.link_requested_at = datetime(2026, 10, 2, tzinfo=UTC)
    older.link_requested_at = datetime(2026, 10, 1, tzinfo=UTC)
    session.commit()
    login(client, manager)

    response = client.get("/api/apartments/me/buyers")

    residents = response.json()
    assert residents[0]["unit"] == "12"
    assert residents[1]["unit"] == "11"


def test_list_residents_rejects_unknown_status(client: TestClient, session: Session):
    manager = add_user(session, "sindico@example.com")
    add_building(session, manager)
    login(client, manager)

    response = client.get("/api/apartments/me/buyers", params={"status": "QUALQUER"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.parametrize(
    "action, link_status", [("approve", "APROVADO"), ("reject", "RECUSADO")]
)
def test_manager_reviews_a_pending_resident(
    client: TestClient, session: Session, action: str, link_status: str
):
    bia = add_user(session, "bia@example.com")
    manager = add_user(session, "sindico@example.com")
    building = add_building(session, manager)
    caio = add_user(session, "caio@example.com")
    neighbor = add_resident(session, building, caio, unit="12")
    resident = add_resident(session, building, bia)
    login(client, manager)

    response = client.post(f"/api/apartments/me/buyers/{resident.public_id}/{action}")

    session.refresh(neighbor)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["public_id"] == str(resident.public_id)
    assert response.json()["link_status"] == link_status
    assert response.json()["link_reviewed_at"] is not None
    assert neighbor.link_status == LinkStatus.PENDENTE


def test_approved_resident_sees_the_approval(client: TestClient, session: Session):
    manager = add_user(session, "sindico@example.com")
    building = add_building(session, manager)
    bia = add_user(session, "bia@example.com")
    resident = add_resident(session, building, bia)
    login(client, manager)
    client.post(f"/api/apartments/me/buyers/{resident.public_id}/approve")
    login(client, bia)

    response = client.get("/api/profiles/me")

    assert response.json()["buyer"]["link_status"] == "APROVADO"


@pytest.mark.parametrize(
    "current_status, action, new_status",
    [
        (LinkStatus.APROVADO, "reject", "RECUSADO"),
        (LinkStatus.RECUSADO, "approve", "APROVADO"),
    ],
    ids=["revoga-aprovado", "aprova-recusado"],
)
def test_manager_can_change_a_previous_decision(
    client: TestClient,
    session: Session,
    current_status: LinkStatus,
    action: str,
    new_status: str,
):
    manager = add_user(session, "sindico@example.com")
    building = add_building(session, manager)
    bia = add_user(session, "bia@example.com")
    resident = add_resident(session, building, bia, link_status=current_status)
    login(client, manager)

    response = client.post(f"/api/apartments/me/buyers/{resident.public_id}/{action}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["link_status"] == new_status


@pytest.mark.parametrize("action", ["approve", "reject"])
def test_manager_cannot_review_resident_of_another_building(
    client: TestClient, session: Session, action: str
):
    manager = add_user(session, "sindico@example.com")
    add_building(session, manager)
    other_building = add_building(
        session, add_user(session, "outro@example.com"), name="Edifício Bauru"
    )
    resident = add_resident(session, other_building, add_user(session, "duda@example.com"))
    login(client, manager)

    response = client.post(f"/api/apartments/me/buyers/{resident.public_id}/{action}")

    session.refresh(resident)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Morador não encontrado"
    assert resident.link_status == LinkStatus.PENDENTE


def test_review_of_unknown_resident_returns_404(client: TestClient, session: Session):
    manager = add_user(session, "sindico@example.com")
    add_building(session, manager)
    login(client, manager)

    response = client.post(f"/api/apartments/me/buyers/{UNKNOWN_ID}/approve")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Morador não encontrado"


@pytest.mark.parametrize("profile", ["farmer", "buyer", None])
def test_resident_routes_require_a_manager(
    client: TestClient, session: Session, profile: str | None
):
    building = add_building(session, add_user(session, "sindico@example.com"))
    ana = add_user(session, "ana@example.com")
    if profile == "farmer":
        add_farmer(session, ana)
    if profile == "buyer":
        add_resident(session, building, ana, link_status=LinkStatus.APROVADO)
    login(client, ana)

    list_response = client.get("/api/apartments/me/buyers")
    approve_response = client.post(f"/api/apartments/me/buyers/{UNKNOWN_ID}/approve")
    reject_response = client.post(f"/api/apartments/me/buyers/{UNKNOWN_ID}/reject")

    assert list_response.status_code == status.HTTP_403_FORBIDDEN
    assert approve_response.status_code == status.HTTP_403_FORBIDDEN
    assert reject_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", "/api/apartments"),
        ("GET", "/api/apartments/me/buyers"),
        ("POST", f"/api/apartments/me/buyers/{UNKNOWN_ID}/approve"),
        ("POST", f"/api/apartments/me/buyers/{UNKNOWN_ID}/reject"),
    ],
)
def test_apartment_routes_require_login(client: TestClient, method: str, path: str):
    response = client.request(method, path)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
