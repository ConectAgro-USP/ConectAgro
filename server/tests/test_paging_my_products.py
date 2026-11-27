from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ
from tests.helpers import add_product
from tests.paging import assert_page_size_limits, assert_pages_cover_everything, keys_of

URL = "/api/products/me"
SAME_TIME = datetime(2026, 11, 1, 12, tzinfo=UTC)


def add_products(session: Session, farmer: Farmer, count: int) -> list[str]:
    products = [
        add_product(session, farmer, f"Produto {number}", created_at=SAME_TIME)
        for number in range(count)
    ]
    return sorted(str(product.public_id) for product in products)


def test_my_products_come_in_pages_without_repeating_ties(
    client: TestClient, session: Session, farmer: Farmer
):
    expected = add_products(session, farmer, 5)

    assert_pages_cover_everything(client, URL, expected)


def test_my_products_keep_the_creation_order_across_pages(
    client: TestClient, session: Session, farmer: Farmer
):
    for day, name in enumerate(["Couve", "Alface", "Rúcula"]):
        add_product(session, farmer, name, created_at=SAME_TIME + timedelta(days=day))

    assert_pages_cover_everything(client, URL, ["Couve", "Alface", "Rúcula"], key="name")


def test_my_products_limit_the_page_size(client: TestClient, session: Session, farmer: Farmer):
    add_products(session, farmer, 1)

    assert_page_size_limits(client, URL)


def test_my_products_count_every_state_whatever_the_page(
    client: TestClient, session: Session, farmer: Farmer
):
    today = datetime.now(BUSINESS_TZ).date()
    add_product(session, farmer, "Alface")
    add_product(session, farmer, "Couve", expiration_date=today + timedelta(days=7))
    add_product(session, farmer, "Mandioca", expiration_date=today + timedelta(days=8))
    add_product(session, farmer, "Rúcula", quantity=0)
    add_product(session, farmer, "Abóbora", expiration_date=today - timedelta(days=1))
    add_product(session, farmer, "Milho", is_available=False)
    add_product(session, farmer, "Milho sem estoque", is_available=False, quantity=0)

    body = client.get(URL, params={"page_size": 1}).json()

    assert len(body["items"]) == 1
    assert body["total"] == 7
    assert body["counts"] == {
        "all": 7,
        "available": 3,
        "hidden": 4,
        "sold_out": 1,
        "expiring_soon": 1,
    }


def test_my_products_filter_what_is_on_sale_and_what_is_hidden(
    client: TestClient, session: Session, farmer: Farmer
):
    today = datetime.now(BUSINESS_TZ).date()
    add_product(session, farmer, "Alface")
    add_product(session, farmer, "Rúcula", quantity=0)
    add_product(session, farmer, "Abóbora", expiration_date=today - timedelta(days=1))
    add_product(session, farmer, "Milho", is_available=False)

    on_sale = client.get(URL, params={"availability": "available"}).json()
    hidden = client.get(URL, params={"availability": "hidden"}).json()

    assert keys_of([on_sale], "name") == ["Alface"]
    assert on_sale["total"] == 1
    assert sorted(keys_of([hidden], "name")) == ["Abóbora", "Milho", "Rúcula"]
    assert hidden["counts"]["all"] == 4


def test_my_products_page_shows_only_the_farmer_products(
    client: TestClient, session: Session, farmer: Farmer, seller: Farmer
):
    add_product(session, seller, "Couve")
    add_product(session, farmer, "Alface")

    body = client.get(URL).json()

    assert keys_of([body], "name") == ["Alface"]
    assert body["counts"]["all"] == 1
