from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.interest import Interest
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_resident, add_user, login


def test_apartment_needs_sums_interests_past_the_largest_single_interest(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    product = add_product(session, farmer, name="Alface")
    for email in ("res1@example.com", "res2@example.com"):
        resident = add_resident(
            session, building, add_user(session, email), link_status=LinkStatus.APROVADO
        )
        session.add(Interest(buyer_id=resident.id, product_id=product.id, quantity=2_147_483_647))
    session.commit()
    login(client, manager)

    response = client.get("/api/apartments/me/needs")

    assert response.status_code == status.HTTP_200_OK
    need = response.json()["items"][0]
    assert need["total_quantity"] == 4_294_967_294
    assert need["interested_buyers_count"] == 2
