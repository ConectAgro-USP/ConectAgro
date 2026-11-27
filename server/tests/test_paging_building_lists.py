from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.user import User
from tests.helpers import add_interest, add_product, add_resident, add_user, login
from tests.paging import assert_page_size_limits, assert_pages_cover_everything

NEEDS_URL = "/api/apartments/me/needs"
RESIDENTS_URL = "/api/apartments/me/buyers"
SAME_TIME = datetime(2026, 11, 1, 12, tzinfo=UTC)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User) -> None:
    login(client, manager)


def product_id(need: dict) -> str:
    return need["product"]["public_id"]


def add_needs(session: Session, resident: Buyer, farmer: Farmer, *quantities: int) -> list[str]:
    products = []
    for number, quantity in enumerate(quantities):
        product = add_product(session, farmer, f"Produto {number}")
        add_interest(session, resident, product, quantity=quantity)
        products.append(product)
    return [str(product.public_id) for product in products]


def add_residents(session: Session, building: Apartment, count: int) -> list[str]:
    residents = []
    for number in range(count):
        user = add_user(session, f"morador{number}@example.com")
        resident = add_resident(session, building, user, unit=str(number))
        resident.link_requested_at = SAME_TIME
        residents.append(resident)
    session.commit()
    return [str(resident.public_id) for resident in residents]


def test_needs_with_the_same_total_come_in_pages_without_repeating(
    client: TestClient, session: Session, resident: Buyer, seller: Farmer
):
    products = add_needs(session, resident, seller, 1, 1, 1, 1, 1)

    assert_pages_cover_everything(client, NEEDS_URL, sorted(products), key=product_id)


def test_needs_keep_the_chosen_order_across_pages(
    client: TestClient, session: Session, resident: Buyer, seller: Farmer
):
    small, large, medium = add_needs(session, resident, seller, 1, 9, 5)

    assert_pages_cover_everything(
        client, NEEDS_URL, [large, medium, small], key=product_id, descending=True
    )
    assert_pages_cover_everything(
        client, NEEDS_URL, [small, medium, large], key=product_id, descending=False
    )


def test_needs_limit_the_page_size(
    client: TestClient, session: Session, resident: Buyer, seller: Farmer
):
    add_needs(session, resident, seller, 1)

    assert_page_size_limits(client, NEEDS_URL)


def test_residents_with_the_same_request_time_come_in_pages_without_repeating(
    client: TestClient, session: Session, building: Apartment
):
    expected = add_residents(session, building, 5)

    assert_pages_cover_everything(client, RESIDENTS_URL, expected)
    assert_pages_cover_everything(client, RESIDENTS_URL, expected, status="PENDENTE")


def test_residents_page_counts_only_the_chosen_status(
    client: TestClient, session: Session, building: Apartment, resident: Buyer
):
    add_residents(session, building, 3)

    pending = client.get(RESIDENTS_URL, params={"status": "PENDENTE", "page_size": 1}).json()
    approved = client.get(RESIDENTS_URL, params={"status": "APROVADO"}).json()

    assert (len(pending["items"]), pending["total"], pending["total_pages"]) == (1, 3, 3)
    assert [item["public_id"] for item in approved["items"]] == [str(resident.public_id)]
    assert approved["items"][0]["link_status"] == LinkStatus.APROVADO


def test_residents_limit_the_page_size(
    client: TestClient, session: Session, building: Apartment
):
    add_residents(session, building, 1)

    assert_page_size_limits(client, RESIDENTS_URL)
