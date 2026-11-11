from datetime import date
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.purchase import Purchase, PurchasePart, PurchaseStatus
from src.models.user import User
from tests.helpers import add_farmer, add_resident, add_user, login

REVIEWABLE_URL = "/api/purchases/reviewable"
DELIVERED = PurchaseStatus.ENTREGUE
IN_PROGRESS = PurchaseStatus.EM_PROGRESSO
LISTED_FIELDS = {"public_id", "rating", "comment", "created_at", "updated_at"}


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User) -> None:
    login(client, manager)


@pytest.fixture
def joao(session: Session) -> Farmer:
    return add_farmer(session, add_user(session, "joao@example.com", name="João Lima"))


@pytest.fixture
def maria(session: Session) -> Farmer:
    return add_farmer(session, add_user(session, "maria@example.com"))


@pytest.fixture
def purchase(session: Session, building: Apartment, joao: Farmer, maria: Farmer) -> Purchase:
    return add_purchase(session, building.id, (joao, DELIVERED), (maria, IN_PROGRESS))


@pytest.fixture
def resident(session: Session, building: Apartment) -> Buyer:
    user = add_user(session, "morador@example.com")
    return add_resident(session, building, user, link_status=LinkStatus.APROVADO)


def add_purchase(session: Session, building_id: int, *parts: tuple) -> Purchase:
    purchase = Purchase(apartment_id=building_id, expected_delivery_date=date(2030, 1, 1))
    for farmer, part_status in parts:
        purchase.purchase_parts.append(PurchasePart(farmer_id=farmer.id, status=part_status))
    session.add(purchase)
    session.commit()
    return purchase


def reviews_url(purchase: Purchase, farmer: Farmer) -> str:
    return f"/api/purchases/{purchase.public_id}/farmers/{farmer.public_id}/reviews"


def test_manager_and_resident_review_and_farmer_gets_the_average(
    client: TestClient, building: Apartment, purchase: Purchase, joao: Farmer, resident: Buyer
):
    url = reviews_url(purchase, joao)
    by_manager = client.post(url, json={"rating": 5, "comment": "Ótimo"})
    repeated = client.post(url, json={"rating": 1})
    login(client, resident.user)
    by_resident = client.post(url, json={"rating": 2})
    public = client.get(f"/api/farmers/{joao.public_id}/reviews")
    login(client, joao.user)
    own = client.get("/api/farmers/me/reviews")

    assert by_manager.status_code == status.HTTP_201_CREATED
    assert by_manager.json()["apartment_public_id"] == str(building.public_id)
    assert by_manager.json()["buyer_public_id"] is None
    assert by_manager.json()["purchase_public_id"] == str(purchase.public_id)
    assert by_manager.json()["farmer_public_id"] == str(joao.public_id)
    assert repeated.status_code == status.HTTP_409_CONFLICT
    assert by_resident.status_code == status.HTTP_201_CREATED
    assert by_resident.json()["buyer_public_id"] == str(resident.public_id)
    assert by_resident.json()["comment"] == ""
    assert public.json() == own.json()
    assert (own.json()["average_rating"], own.json()["reviews_count"]) == (3.5, 2)
    assert [set(review) for review in own.json()["reviews"]] == [LISTED_FIELDS, LISTED_FIELDS]
    assert [review["rating"] for review in own.json()["reviews"]] == [2, 5]


@pytest.mark.parametrize(
    "body",
    [{"rating": None}, {"rating": 0}, {"rating": 6}, {"rating": 4.5}]
    + [{"comment": "a" * 501}, {"comment": "a\x00"}],
    ids=["sem-nota", "nota-zero", "nota-seis", "nota-quebrada", "longo", "caractere-nulo"],
)
def test_review_rejects_invalid_body(
    client: TestClient, purchase: Purchase, joao: Farmer, body: dict
):
    response = client.post(reviews_url(purchase, joao), json={"rating": 5} | body)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.get(REVIEWABLE_URL).json() != []


def test_only_delivered_parts_of_the_purchase_can_be_reviewed(
    client: TestClient, session: Session, purchase: Purchase, joao: Farmer, maria: Farmer
):
    pedro = add_farmer(session, add_user(session, "pedro@example.com"))
    client.post(reviews_url(purchase, joao), json={"rating": 5})
    unknown_purchase = Purchase(public_id=uuid4())
    in_progress = client.post(reviews_url(purchase, maria), json={"rating": 5})
    purchase.purchase_parts[1].status = PurchaseStatus.CANCELADA
    session.commit()
    cancelled = client.post(reviews_url(purchase, maria), json={"rating": 5})
    outside = client.post(reviews_url(purchase, pedro), json={"rating": 5})
    unknown = client.post(reviews_url(unknown_purchase, joao), json={"rating": 5})

    assert in_progress.status_code == status.HTTP_409_CONFLICT
    assert cancelled.status_code == status.HTTP_409_CONFLICT
    assert outside.status_code == status.HTTP_404_NOT_FOUND
    assert unknown.status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/farmers/{uuid4()}/reviews").status_code == status.HTTP_404_NOT_FOUND
    empty = {"average_rating": None, "reviews_count": 0, "reviews": []}
    assert client.get(f"/api/farmers/{maria.public_id}/reviews").json() == empty


def test_people_outside_the_building_cannot_review(
    client: TestClient,
    session: Session,
    building: Apartment,
    other_building: Apartment,
    purchase: Purchase,
    joao: Farmer,
):
    forbidden = status.HTTP_403_FORBIDDEN
    url = reviews_url(purchase, joao)
    review = client.post(url, json={"rating": 5}).json()
    pending = add_resident(session, building, add_user(session, "pendente@example.com"))
    neighbor = add_user(session, "vizinho@example.com")
    add_resident(session, other_building, neighbor, link_status=LinkStatus.APROVADO)
    for user in [other_building.manager, neighbor, pending.user, joao.user]:
        login(client, user)
        assert client.post(url, json={"rating": 1}).status_code == forbidden
        assert client.patch(f"/api/reviews/{review['public_id']}", json={}).status_code == forbidden
    login(client, joao.user)
    assert client.get(REVIEWABLE_URL).status_code == forbidden
    assert client.get("/api/farmers/me/reviews").json()["average_rating"] == 5
    login(client, neighbor)
    assert client.get(REVIEWABLE_URL).json() == []
    assert client.get("/api/farmers/me/reviews").status_code == forbidden
    client.cookies.clear()
    unauthorized = status.HTTP_401_UNAUTHORIZED
    assert client.post(url, json={"rating": 1}).status_code == unauthorized
    assert client.get(f"/api/farmers/{joao.public_id}/reviews").status_code == unauthorized


def test_only_the_author_updates_the_review(
    client: TestClient, purchase: Purchase, joao: Farmer, resident: Buyer
):
    created = client.post(reviews_url(purchase, joao), json={"rating": 5, "comment": "Ótimo"})
    url = f"/api/reviews/{created.json()['public_id']}"
    updated = client.patch(url, json={"rating": 3})
    invalid = client.patch(url, json={"comment": None})
    unknown = client.patch(f"/api/reviews/{uuid4()}", json={"rating": 3})
    login(client, resident.user)
    by_other = client.patch(url, json={"rating": 1})

    assert updated.status_code == status.HTTP_200_OK
    assert (updated.json()["rating"], updated.json()["comment"]) == (3, "Ótimo")
    assert updated.json()["updated_at"] is not None
    assert invalid.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert unknown.status_code == status.HTTP_404_NOT_FOUND
    assert by_other.status_code == status.HTTP_403_FORBIDDEN


def test_reviewable_lists_delivered_parts_not_yet_reviewed_by_the_user(
    client: TestClient, session: Session, purchase: Purchase, joao: Farmer, resident: Buyer
):
    lucas = add_farmer(session, add_user(session, "lucas@example.com", name="Lucas Reis"))
    second = add_purchase(session, purchase.apartment_id, (joao, DELIVERED), (lucas, DELIVERED))
    rows = [(second, lucas, "Lucas R."), (second, joao, "João L."), (purchase, joao, "João L.")]
    pending = [
        {"purchase_public_id": str(bought.public_id), "farmer_public_id": str(farmer.public_id)}
        | {"farmer_short_name": name}
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
