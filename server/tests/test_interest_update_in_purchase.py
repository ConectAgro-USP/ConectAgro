from datetime import datetime, timedelta

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.interest import Interest
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import PurchaseStatus
from src.models.user import User
from tests.helpers import add_farmer, add_interest, add_product, add_purchase, add_user, login

IN_PURCHASE = "Este interesse já está numa compra do prédio"
OUT_OF_CATALOG = "Este produto não está mais disponível no catálogo"


@pytest.fixture
def lettuce(session: Session) -> Product:
    joao = add_farmer(session, add_user(session, "joao@example.com"))
    return add_product(session, joao, name="Alface")


@pytest.fixture
def interest(session: Session, resident: Buyer, lettuce: Product) -> Interest:
    interest = add_interest(session, resident, lettuce, quantity=3)
    session.refresh(interest)
    return interest


def link(session: Session, building: Apartment, interest: Interest, part_status: str) -> None:
    purchase = add_purchase(session, building, (interest.product, 3), status=part_status)
    interest.purchase_part_id = purchase.purchase_parts[0].id
    session.commit()


def patch(client: TestClient, resident: Buyer, interest: Interest, quantity: int) -> Response:
    login(client, resident.user)
    return client.patch(f"/api/interests/{interest.public_id}", json={"quantity": quantity})


def needs(client: TestClient, manager: User) -> dict[str, int]:
    login(client, manager)
    rows = client.get("/api/apartments/me/needs").json()
    return {row["product"]["name"]: row["total_quantity"] for row in rows}


def test_interest_in_purchase_cannot_change_its_quantity(
    client: TestClient, session: Session, building: Apartment, resident: Buyer, interest: Interest
):
    link(session, building, interest, PurchaseStatus.EM_PROGRESSO)

    response = patch(client, resident, interest, 5)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": IN_PURCHASE}
    session.refresh(interest)
    assert interest.quantity == 3


def test_patch_on_a_delivered_interest_asks_again_with_the_new_quantity(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    resident: Buyer,
    interest: Interest,
):
    link(session, building, interest, PurchaseStatus.ENTREGUE)

    response = patch(client, resident, interest, 2)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["quantity"] == 2
    assert response.json()["purchase"] is None
    assert needs(client, manager) == {"Alface": 2}


def test_delivered_interest_cannot_be_asked_again_outside_the_catalog(
    client: TestClient,
    session: Session,
    building: Apartment,
    resident: Buyer,
    lettuce: Product,
    interest: Interest,
):
    link(session, building, interest, PurchaseStatus.ENTREGUE)
    lettuce.is_available = False
    session.commit()

    response = patch(client, resident, interest, 1)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": OUT_OF_CATALOG}
    session.refresh(interest)
    assert interest.purchase_part_id is not None


def test_open_interest_outside_the_catalog_can_only_go_down(
    client: TestClient, session: Session, resident: Buyer, lettuce: Product, interest: Interest
):
    lettuce.expiration_date = datetime.now(BUSINESS_TZ).date() - timedelta(days=1)
    session.commit()

    raised = patch(client, resident, interest, 4)
    lowered = patch(client, resident, interest, 2)

    assert raised.status_code == status.HTTP_409_CONFLICT
    assert raised.json() == {"detail": OUT_OF_CATALOG}
    assert lowered.status_code == status.HTTP_200_OK
    assert lowered.json()["quantity"] == 2


def test_interest_of_a_cancelled_part_changes_like_an_open_one(
    client: TestClient, session: Session, building: Apartment, resident: Buyer, interest: Interest
):
    link(session, building, interest, PurchaseStatus.CANCELADA)

    response = patch(client, resident, interest, 6)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["quantity"] == 6
    assert response.json()["purchase"] is None


@pytest.mark.parametrize(
    "part_status",
    [PurchaseStatus.EM_PROGRESSO, PurchaseStatus.ENTREGUE, PurchaseStatus.CANCELADA],
    ids=["em-progresso", "entregue", "cancelada"],
)
def test_resident_deletes_the_interest_in_any_state(
    client: TestClient,
    session: Session,
    building: Apartment,
    resident: Buyer,
    interest: Interest,
    part_status: PurchaseStatus,
):
    link(session, building, interest, part_status)
    login(client, resident.user)

    response = client.delete(f"/api/interests/{interest.public_id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert session.exec(select(Interest)).all() == []
