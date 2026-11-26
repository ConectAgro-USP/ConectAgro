import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.api import rate_limits
from src.models.farmer import Farmer
from src.models.product import Product
from src.services.product_picture_service import MAX_PICTURE_BYTES
from tests.helpers import add_farmer, add_product, add_user, login
from tests.test_product_picture_upload import PNG, stored_pictures


def upload(client: TestClient, product: Product, ip: str = "200.1.1.1"):
    headers = {"Content-Type": "image/png", "X-Forwarded-For": f"{ip}, 10.0.0.1"}
    return client.post(f"/api/products/{product.public_id}/picture", content=PNG, headers=headers)


def test_uploads_stop_at_the_limit_of_the_account(
    client: TestClient, session: Session, farmer: Farmer, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PICTURE_UPLOADS_PER_USER, "max_attempts", 2)
    products = [add_product(session, farmer, f"Produto {index}") for index in range(3)]

    first, second, third = (upload(client, product) for product in products)

    assert first.status_code == second.status_code == status.HTTP_200_OK
    assert third.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert third.json()["detail"] == "Muitas tentativas. Tente novamente mais tarde"
    assert len(stored_pictures(session)) == 2


def test_the_limit_of_one_account_does_not_block_another(
    client: TestClient, session: Session, farmer: Farmer, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PICTURE_UPLOADS_PER_USER, "max_attempts", 1)
    upload(client, add_product(session, farmer))
    other = add_farmer(session, add_user(session, "maria@example.com", name="Maria Lima"))
    login(client, other.user)

    response = upload(client, add_product(session, other))

    assert response.status_code == status.HTTP_200_OK


def test_uploads_of_many_accounts_block_the_ip(
    client: TestClient, session: Session, farmer: Farmer, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PICTURE_UPLOADS_PER_IP, "max_attempts", 1)
    upload(client, add_product(session, farmer))
    other = add_farmer(session, add_user(session, "maria@example.com", name="Maria Lima"))
    login(client, other.user)
    product = add_product(session, other)

    blocked = upload(client, product)
    elsewhere = upload(client, product, ip="200.2.2.2")

    assert blocked.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert elsewhere.status_code == status.HTTP_200_OK


@pytest.mark.parametrize("declared", [True, False], ids=["com-tamanho", "sem-tamanho"])
def test_the_limit_applies_before_the_picture_is_read(
    client: TestClient,
    session: Session,
    farmer: Farmer,
    monkeypatch: pytest.MonkeyPatch,
    declared: bool,
):
    monkeypatch.setattr(rate_limits.PICTURE_UPLOADS_PER_USER, "max_attempts", 0)
    product = add_product(session, farmer)
    # lido antes do limite, este corpo daria 413
    too_large = b"x" * (MAX_PICTURE_BYTES + 1)

    response = client.post(
        f"/api/products/{product.public_id}/picture",
        content=too_large if declared else iter([too_large]),
        headers={"Content-Type": "image/png"},
    )

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
