from datetime import UTC, datetime

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.purchase import PurchaseStatus
from src.models.review import Review
from tests.helpers import add_product, add_purchase_from
from tests.test_product_picture_upload import PNG, upload


def uploaded_picture_url(client: TestClient, session: Session, farmer: Farmer) -> str:
    product = add_product(session, farmer)
    picture_url = upload(client, product, PNG).json()["picture_url"]
    client.cookies.clear()
    return picture_url


def test_visitor_sees_the_picture_with_public_cache(
    client: TestClient, session: Session, farmer: Farmer
):
    picture_url = uploaded_picture_url(client, session, farmer)

    response = client.get(picture_url)

    assert response.status_code == status.HTTP_200_OK
    assert response.content == PNG
    assert response.headers["cache-control"] == "public, max-age=86400"
    assert response.headers["etag"]


def test_visitor_gets_not_modified_for_a_known_picture(
    client: TestClient, session: Session, farmer: Farmer
):
    picture_url = uploaded_picture_url(client, session, farmer)
    etag = client.get(picture_url).headers["etag"]

    response = client.get(picture_url, headers={"If-None-Match": etag})

    assert response.status_code == status.HTTP_304_NOT_MODIFIED
    assert response.headers["etag"] == etag
    assert response.headers["cache-control"] == "public, max-age=86400"


def test_visitor_reads_the_farmer_reviews_without_authors(
    client: TestClient, session: Session, building: Apartment, joao: Farmer
):
    purchase = add_purchase_from(session, building.id, (joao, PurchaseStatus.ENTREGUE))
    review = Review(
        purchase_id=purchase.id,
        farmer_id=joao.id,
        apartment_id=building.id,
        rating=4,
        comment="Muito fresca",
        created_at=datetime(2026, 11, 1, 12, tzinfo=UTC),
    )
    session.add(review)
    session.commit()

    response = client.get(f"/api/farmers/{joao.public_id}/reviews?with_comment=true")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["average_rating"] == 4
    assert body["reviews_count"] == 1
    assert [item["comment"] for item in body["items"]] == ["Muito fresca"]
    assert "purchase_public_id" not in body["items"][0]
    assert "apartment_public_id" not in body["items"][0]
