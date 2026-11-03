from datetime import UTC, datetime

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.user import User
from tests.helpers import (
    ITAU_CNPJ,
    add_building,
    add_farmer,
    add_resident,
    add_user,
    login,
)

UNKNOWN_ID = "6f1c2b9e-3d4a-4e5f-8a7b-9c0d1e2f3a4b"


@pytest.mark.usefixtures("other_building")
def test_list_apartments_returns_every_building_with_the_cnpj(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
):
    building.address = "Rua Quatro, 251 - Vila Verde, Rio Grande da Serra"
    session.commit()
    copy = add_building(session, add_user(session, "copia@example.com"), name="Edifício Cópia")

    response = client.get("/api/apartments", params={"cnpj": "00.000.000/0001-91"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == [
        {
            "public_id": str(building.public_id),
            "building_name": "Edifício Araraquara",
            "building_cnpj": "00000000000191",
            "zip_code": "01310200",
            "address": "Rua Quatro, 251 - Vila Verde, Rio Grande da Serra",
        },
        {
            "public_id": str(copy.public_id),
            "building_name": "Edifício Cópia",
            "building_cnpj": "00000000000191",
            "zip_code": "01310200",
            "address": None,
        },
    ]


@pytest.mark.parametrize("cnpj", ["60.701.190/0001-04", "60701190000104"])
@pytest.mark.usefixtures("ana", "building")
def test_list_apartments_finds_the_building_by_cnpj(
    client: TestClient, other_building: Apartment, cnpj: str
):
    response = client.get("/api/apartments", params={"cnpj": cnpj})

    assert response.status_code == status.HTTP_200_OK
    assert [found["public_id"] for found in response.json()] == [str(other_building.public_id)]


@pytest.mark.usefixtures("ana", "building")
def test_list_apartments_by_unregistered_cnpj_is_empty(client: TestClient):
    response = client.get("/api/apartments", params={"cnpj": ITAU_CNPJ})

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


@pytest.mark.parametrize(
    "params",
    [{"cnpj": "60.701.190/0001-05"}, {"cnpj": "6" * 21}, {}],
    ids=["verificador", "longo", "sem-cnpj"],
)
@pytest.mark.usefixtures("ana")
def test_list_apartments_requires_a_valid_cnpj(client: TestClient, params: dict):
    response = client.get("/api/apartments", params=params)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_manager_lists_residents_by_status(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    other_building: Apartment,
):
    bia = add_user(session, "bia@example.com", name="Bia Lima")
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


def test_manager_lists_every_resident_without_status(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    other_building: Apartment,
):
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


def test_residents_are_listed_from_the_oldest_request(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
):
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


@pytest.mark.usefixtures("building")
def test_list_residents_rejects_unknown_status(client: TestClient, manager: User):
    login(client, manager)

    response = client.get("/api/apartments/me/buyers", params={"status": "QUALQUER"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.parametrize("action, link_status", [("approve", "APROVADO"), ("reject", "RECUSADO")])
def test_manager_reviews_a_pending_resident(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    action: str,
    link_status: str,
):
    bia = add_user(session, "bia@example.com")
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


def test_approved_resident_sees_the_approval(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
):
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
    manager: User,
    building: Apartment,
    current_status: LinkStatus,
    action: str,
    new_status: str,
):
    bia = add_user(session, "bia@example.com")
    resident = add_resident(session, building, bia, link_status=current_status)
    login(client, manager)

    response = client.post(f"/api/apartments/me/buyers/{resident.public_id}/{action}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["link_status"] == new_status


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.usefixtures("building")
def test_manager_cannot_review_resident_of_another_building(
    client: TestClient,
    session: Session,
    manager: User,
    other_building: Apartment,
    action: str,
):
    resident = add_resident(session, other_building, add_user(session, "duda@example.com"))
    login(client, manager)

    response = client.post(f"/api/apartments/me/buyers/{resident.public_id}/{action}")

    session.refresh(resident)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Morador não encontrado"
    assert resident.link_status == LinkStatus.PENDENTE


@pytest.mark.usefixtures("building")
def test_review_of_unknown_resident_returns_404(client: TestClient, manager: User):
    login(client, manager)

    response = client.post(f"/api/apartments/me/buyers/{UNKNOWN_ID}/approve")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Morador não encontrado"


@pytest.mark.parametrize("profile", ["farmer", "buyer", None])
def test_resident_routes_require_a_manager(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
    profile: str | None,
):
    if profile == "farmer":
        add_farmer(session, ana)
    if profile == "buyer":
        add_resident(session, building, ana, link_status=LinkStatus.APROVADO)

    list_response = client.get("/api/apartments/me/buyers")
    approve_response = client.post(f"/api/apartments/me/buyers/{UNKNOWN_ID}/approve")
    reject_response = client.post(f"/api/apartments/me/buyers/{UNKNOWN_ID}/reject")

    assert list_response.status_code == status.HTTP_403_FORBIDDEN
    assert approve_response.status_code == status.HTTP_403_FORBIDDEN
    assert reject_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", "/api/apartments?cnpj=00000000000191"),
        ("GET", "/api/apartments/me/buyers"),
        ("POST", f"/api/apartments/me/buyers/{UNKNOWN_ID}/approve"),
        ("POST", f"/api/apartments/me/buyers/{UNKNOWN_ID}/reject"),
    ],
)
def test_apartment_routes_require_login(client: TestClient, method: str, path: str):
    response = client.request(method, path)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
