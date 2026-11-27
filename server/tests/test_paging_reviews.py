from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.purchase import Purchase, PurchaseStatus
from src.models.review import Review
from src.models.user import User
from tests.helpers import add_purchase_from, login
from tests.paging import assert_page_size_limits, assert_pages_cover_everything, keys_of

REVIEWABLE_URL = "/api/purchases/reviewable"
MY_REVIEWS_URL = "/api/reviews/me"
SAME_TIME = datetime(2026, 11, 1, 12, tzinfo=UTC)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User) -> None:
    login(client, manager)


def farmer_url(farmer: Farmer) -> str:
    return f"/api/farmers/{farmer.public_id}/reviews"


def add_deliveries(session: Session, building: Apartment, farmer: Farmer, count: int):
    purchases = []
    for _ in range(count):
        purchase = add_purchase_from(session, building.id, (farmer, PurchaseStatus.ENTREGUE))
        purchase.purchase_parts[0].closed_at = SAME_TIME
        purchases.append(purchase)
    session.commit()
    return purchases


def add_reviews(
    session: Session, building: Apartment, farmer: Farmer, *comments: str
) -> list[str]:
    reviews = []
    purchases = add_deliveries(session, building, farmer, len(comments))
    for rating, (purchase, comment) in enumerate(zip(purchases, comments, strict=True), 1):
        reviews.append(review_of(purchase, building, farmer, rating, comment))
    session.add_all(reviews)
    session.commit()
    # a mais nova vem antes, e no empate a última gravada
    return [str(review.public_id) for review in reversed(reviews)]


def review_of(purchase: Purchase, building: Apartment, farmer: Farmer, rating: int, comment: str):
    return Review(
        purchase_id=purchase.id,
        farmer_id=farmer.id,
        apartment_id=building.id,
        rating=rating,
        comment=comment,
        created_at=SAME_TIME,
    )


def test_reviewable_deliveries_come_in_pages_without_repeating(
    client: TestClient, session: Session, building: Apartment, joao: Farmer
):
    purchases = add_deliveries(session, building, joao, 5)
    expected = [str(purchase.public_id) for purchase in reversed(purchases)]

    assert_pages_cover_everything(client, REVIEWABLE_URL, expected, key="purchase_public_id")
    assert_page_size_limits(client, REVIEWABLE_URL)


def test_authored_reviews_come_in_pages_without_repeating(
    client: TestClient, session: Session, building: Apartment, joao: Farmer
):
    expected = add_reviews(session, building, joao, "", "Boa", "", "Ótima", "")

    assert_pages_cover_everything(client, MY_REVIEWS_URL, expected)
    assert_page_size_limits(client, MY_REVIEWS_URL)


def test_farmer_reviews_page_the_list_and_keep_the_average_of_all(
    client: TestClient, session: Session, building: Apartment, joao: Farmer
):
    expected = add_reviews(session, building, joao, "", "Boa", "", "Ótima", "")

    first = client.get(farmer_url(joao), params={"page_size": 2}).json()

    assert_pages_cover_everything(client, farmer_url(joao), expected)
    assert_page_size_limits(client, farmer_url(joao))
    assert (first["average_rating"], first["reviews_count"]) == (3.0, 5)


def test_farmer_reviews_can_list_only_the_written_ones(
    client: TestClient, session: Session, building: Apartment, joao: Farmer
):
    add_reviews(session, building, joao, "", "Boa", "   ", "Ótima", "Chegou cedo")

    written = client.get(farmer_url(joao), params={"with_comment": True}).json()

    assert keys_of([written], "comment") == ["Chegou cedo", "Ótima", "Boa"]
    assert written["total"] == 3
    assert (written["average_rating"], written["reviews_count"]) == (3.0, 5)


def test_farmer_reviews_page_shows_only_that_farmer(
    client: TestClient, session: Session, building: Apartment, joao: Farmer, maria: Farmer
):
    add_reviews(session, building, maria, "Boa")
    expected = add_reviews(session, building, joao, "Ótima")

    body = client.get(farmer_url(joao)).json()

    assert keys_of([body]) == expected
    assert (body["total"], body["reviews_count"], body["average_rating"]) == (1, 1, 1.0)
