from uuid import uuid4

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.farmer import Farmer
from tests.helpers import add_product, login
from tests.test_product_picture_upload import PNG, stored_pictures, upload


def test_farmer_cannot_upload_a_picture_to_another_farmer_product(
    client: TestClient, session: Session, farmer: Farmer, seller: Farmer
):
    other_product = add_product(session, seller)

    response = upload(client, other_product, PNG)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "Você só pode alterar seus produtos"
    assert stored_pictures(session) == []
    session.refresh(other_product)
    assert other_product.picture_url is None


def test_upload_to_a_missing_product_is_not_found(client: TestClient, farmer: Farmer):
    response = client.post(
        f"/api/products/{uuid4()}/picture", content=PNG, headers={"Content-Type": "image/png"}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Produto não encontrado"


def test_only_farmers_upload_pictures(
    client: TestClient, session: Session, seller: Farmer, resident: Buyer
):
    product = add_product(session, seller)
    login(client, resident.user)

    response = upload(client, product, PNG)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert stored_pictures(session) == []


def test_upload_requires_login(client: TestClient, session: Session, seller: Farmer):
    product = add_product(session, seller)

    response = upload(client, product, PNG)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert stored_pictures(session) == []


def test_picture_requires_login_like_the_catalog(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)
    picture_url = upload(client, product, PNG).json()["picture_url"]
    client.cookies.clear()

    response = client.get(picture_url)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_any_logged_in_user_sees_the_picture(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    product = add_product(session, farmer)
    picture_url = upload(client, product, PNG).json()["picture_url"]
    login(client, building.manager)

    response = client.get(picture_url)

    assert response.status_code == status.HTTP_200_OK
    assert response.content == PNG
