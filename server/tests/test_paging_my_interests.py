from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.interest import Interest
from src.models.purchase import PurchaseStatus
from tests.helpers import add_interest, add_product, add_purchase, login
from tests.paging import assert_page_size_limits, assert_pages_cover_everything, keys_of

URL = "/api/interests/me"
SAME_TIME = datetime(2026, 11, 1, 12, tzinfo=UTC)


@pytest.fixture(autouse=True)
def logged_resident(client: TestClient, resident: Buyer) -> None:
    login(client, resident.user)


def add_interests(session: Session, resident: Buyer, farmer: Farmer, count: int) -> list[str]:
    interests = []
    for number in range(count):
        interest = add_interest(session, resident, add_product(session, farmer, f"P{number}"))
        interest.created_at = SAME_TIME
        interests.append(interest)
    session.commit()
    # o mais novo vem antes, e no empate o último gravado
    return [str(interest.public_id) for interest in reversed(interests)]


def test_my_interests_come_in_pages_without_repeating_ties(
    client: TestClient, session: Session, resident: Buyer, seller: Farmer
):
    expected = add_interests(session, resident, seller, 5)

    assert_pages_cover_everything(client, URL, expected)


def test_my_interests_limit_the_page_size(
    client: TestClient, session: Session, resident: Buyer, seller: Farmer
):
    add_interests(session, resident, seller, 1)

    assert_page_size_limits(client, URL)


def test_my_interests_find_the_interest_of_one_product(
    client: TestClient, session: Session, resident: Buyer, seller: Farmer
):
    add_interests(session, resident, seller, 3)
    chosen = add_product(session, seller, "Mandioca")
    interest = add_interest(session, resident, chosen, quantity=4)

    found = client.get(URL, params={"product_public_id": str(chosen.public_id)}).json()
    unknown = client.get(URL, params={"product_public_id": str(uuid4())}).json()

    assert keys_of([found]) == [str(interest.public_id)]
    assert found["total"] == 1
    assert (unknown["items"], unknown["total"]) == ([], 0)


def test_my_interests_estimate_the_open_total_of_every_page(
    client: TestClient,
    session: Session,
    building: Apartment,
    resident: Buyer,
    seller: Farmer,
):
    lettuce = add_product(session, seller, "Alface", price=Decimal("2.50"))
    kale = add_product(session, seller, "Couve", price=Decimal("3.10"))
    paused = add_product(session, seller, "Milho", is_available=False)
    bought = add_product(session, seller, "Rúcula")
    returned = add_product(session, seller, "Abóbora", price=Decimal("1.05"))
    add_interest(session, resident, lettuce, quantity=2)
    add_interest(session, resident, kale, quantity=3)
    add_interest(session, resident, paused, quantity=9)
    link_to_purchase(session, building, add_interest(session, resident, bought, quantity=9))
    cancelled = add_interest(session, resident, returned, quantity=2)
    link_to_purchase(session, building, cancelled, PurchaseStatus.CANCELADA)

    body = client.get(URL, params={"page_size": 1}).json()

    assert len(body["items"]) == 1
    assert body["total"] == 5
    assert body["estimated_total"] == "16.40"


def test_my_interests_estimate_zero_without_open_interests(client: TestClient):
    body = client.get(URL).json()

    assert (body["items"], body["total"], body["estimated_total"]) == ([], 0, "0.00")


def link_to_purchase(
    session: Session,
    building: Apartment,
    interest: Interest,
    part_status: PurchaseStatus = PurchaseStatus.EM_PROGRESSO,
) -> None:
    session.refresh(interest)
    purchase = add_purchase(session, building, (interest.product, 1), status=part_status)
    interest.purchase_part_id = purchase.purchase_parts[0].id
    session.commit()
