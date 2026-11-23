from datetime import UTC, datetime

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.purchase import Purchase, PurchaseStatus
from src.models.user import User
from tests.helpers import (
    add_farmer,
    add_product,
    add_purchase,
    add_purchase_from,
    add_resident,
    add_user,
    login,
    reviews_url,
)

REVIEWABLE_URL = "/api/purchases/reviewable"
MY_REVIEWS_URL = "/api/reviews/me"
DELIVERED = PurchaseStatus.ENTREGUE
LISTED_FIELDS = {"public_id", "rating", "comment", "created_at", "updated_at"}
AUTHOR_FIELDS = LISTED_FIELDS | {
    "purchase_public_id",
    "farmer_public_id",
    "apartment_public_id",
    "buyer_public_id",
    "farmer_short_name",
}


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User) -> None:
    login(client, manager)


def test_reviewable_lists_delivered_parts_not_yet_reviewed_by_the_user(
    client: TestClient, session: Session, purchase: Purchase, joao: Farmer, resident: Buyer
):
    lucas = add_farmer(session, add_user(session, "lucas@example.com", name="Lucas Reis"))
    second = add_purchase_from(
        session, purchase.apartment_id, (joao, DELIVERED), (lucas, DELIVERED)
    )
    rows = [(second, lucas, "Lucas R."), (second, joao, "João L."), (purchase, joao, "João L.")]
    pending = [
        {"purchase_public_id": str(bought.public_id), "farmer_public_id": str(farmer.public_id)}
        | {"farmer_short_name": name, "delivered_at": None, "product_names": []}
        for bought, farmer, name in rows
    ]
    before = client.get(REVIEWABLE_URL)
    client.post(reviews_url(second, joao), json={"rating": 4})
    after = client.get(REVIEWABLE_URL)
    login(client, resident.user)
    review = client.post(reviews_url(second, joao), json={"rating": 4}).json()
    other = add_user(session, "outra@example.com")
    add_resident(session, resident.apartment, other, unit="43", link_status=LinkStatus.APROVADO)
    login(client, other)
    by_other = client.patch(f"/api/reviews/{review['public_id']}", json={"rating": 1})

    assert before.json() == pending
    assert after.json() == [pending[0], pending[2]]
    assert client.get(REVIEWABLE_URL).json() == pending
    assert by_other.status_code == status.HTTP_403_FORBIDDEN


def test_reviewable_tells_when_each_delivery_came_and_with_what(
    client: TestClient, session: Session, building: Apartment, joao: Farmer
):
    mandioca = add_product(session, joao, "Mandioca")
    alface = add_product(session, joao, "Alface")
    delivered = add_purchase(session, building, (mandioca, 2), (alface, 1), status=DELIVERED)
    delivered.purchase_parts[0].closed_at = datetime(2026, 11, 19, 15, 30, tzinfo=UTC)
    session.commit()

    [reviewable] = client.get(REVIEWABLE_URL).json()

    assert reviewable["purchase_public_id"] == str(delivered.public_id)
    assert reviewable["delivered_at"].startswith("2026-11-19T15:30:00")
    assert reviewable["product_names"] == ["Mandioca", "Alface"]


def test_author_finds_own_reviews_to_edit(
    client: TestClient,
    session: Session,
    manager: User,
    purchase: Purchase,
    joao: Farmer,
    resident: Buyer,
):
    lucas = add_farmer(session, add_user(session, "lucas@example.com", name="Lucas Reis"))
    second = add_purchase_from(session, purchase.apartment_id, (lucas, DELIVERED))
    first = client.post(reviews_url(purchase, joao), json={"rating": 5, "comment": "Ótimo"})
    latest = client.post(reviews_url(second, lucas), json={"rating": 2})
    login(client, resident.user)
    by_resident = client.post(reviews_url(purchase, joao), json={"rating": 4})
    resident_reviews = client.get(MY_REVIEWS_URL)
    login(client, manager)
    before = client.get(MY_REVIEWS_URL)
    edit = client.patch(f"/api/reviews/{before.json()[1]['public_id']}", json={"rating": 3})
    after = client.get(MY_REVIEWS_URL)

    assert before.status_code == status.HTTP_200_OK
    assert [set(review) for review in before.json()] == [AUTHOR_FIELDS, AUTHOR_FIELDS]
    assert before.json() == [
        latest.json() | {"farmer_short_name": "Lucas R."},
        first.json() | {"farmer_short_name": "João L."},
    ]
    assert edit.status_code == status.HTTP_200_OK
    assert (after.json()[1]["rating"], after.json()[1]["comment"]) == (3, "Ótimo")
    assert after.json()[1]["updated_at"] is not None
    assert resident_reviews.json() == [by_resident.json() | {"farmer_short_name": "João L."}]


def test_only_managers_and_approved_residents_list_their_reviews(
    client: TestClient,
    session: Session,
    building: Apartment,
    other_building: Apartment,
    purchase: Purchase,
    joao: Farmer,
):
    client.post(reviews_url(purchase, joao), json={"rating": 5})
    pending = add_resident(session, building, add_user(session, "pendente@example.com"))
    login(client, other_building.manager)
    other_manager = client.get(MY_REVIEWS_URL)
    for user in [joao.user, pending.user]:
        login(client, user)
        assert client.get(MY_REVIEWS_URL).status_code == status.HTTP_403_FORBIDDEN
    client.cookies.clear()

    assert other_manager.json() == []
    assert client.get(MY_REVIEWS_URL).status_code == status.HTTP_401_UNAUTHORIZED
