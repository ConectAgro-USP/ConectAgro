import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.models.farmer import Farmer
from src.models.product import Product
from src.models.product_picture import ProductPicture
from src.services.product_picture_service import MAX_PICTURE_BYTES
from tests.helpers import add_product

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 32


def upload(client: TestClient, product: Product, data: bytes, content_type: str = "image/png"):
    return client.post(
        f"/api/products/{product.public_id}/picture",
        content=data,
        headers={"Content-Type": content_type},
    )


def stored_pictures(session: Session) -> list[ProductPicture]:
    return list(session.exec(select(ProductPicture)).all())


@pytest.mark.parametrize(
    "data, content_type",
    [(PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")],
    ids=["png", "jpeg", "webp"],
)
def test_owner_uploads_a_picture_and_the_product_points_to_it(
    client: TestClient, session: Session, farmer: Farmer, data: bytes, content_type: str
):
    product = add_product(session, farmer, picture_url="https://example.com/velha.png")

    response = upload(client, product, data, f"{content_type}; charset=binary")

    assert response.status_code == status.HTTP_200_OK
    picture_url = response.json()["picture_url"]
    assert picture_url.startswith(f"/api/products/{product.public_id}/picture?v=")
    assert len(picture_url.rsplit("=", 1)[1]) == 12
    [picture] = stored_pictures(session)
    assert (picture.data, picture.content_type) == (data, content_type)
    assert len(picture.etag) == 64


def test_new_upload_replaces_the_picture_and_its_version(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)

    first = upload(client, product, PNG).json()["picture_url"]
    second = upload(client, product, JPEG, "image/jpeg").json()["picture_url"]

    assert first != second
    [picture] = stored_pictures(session)
    assert picture.data == JPEG


@pytest.mark.parametrize(
    "data, content_type",
    [
        (PNG, "image/gif"),
        (PNG, "text/plain"),
        (JPEG, "image/png"),
        (b"<svg xmlns='http://www.w3.org/2000/svg'/>", "image/png"),
        (b"", "image/jpeg"),
        (PNG, ""),
    ],
    ids=["gif", "texto", "tipo-trocado", "svg", "vazio", "sem-tipo"],
)
def test_picture_that_is_not_jpeg_png_or_webp_is_refused(
    client: TestClient, session: Session, farmer: Farmer, data: bytes, content_type: str
):
    product = add_product(session, farmer)

    response = upload(client, product, data, content_type)

    assert response.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    assert response.json()["detail"] == "Envie uma foto em JPEG, PNG ou WebP"
    assert stored_pictures(session) == []


def test_picture_of_exactly_one_megabyte_is_accepted(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)
    data = PNG + b"\x00" * (MAX_PICTURE_BYTES - len(PNG))

    assert upload(client, product, data).status_code == status.HTTP_200_OK


def test_picture_above_one_megabyte_is_refused(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)
    data = PNG + b"\x00" * MAX_PICTURE_BYTES

    response = upload(client, product, data)

    assert response.status_code == status.HTTP_413_CONTENT_TOO_LARGE
    assert response.json()["detail"] == "A foto deve ter no máximo 1 MB"
    assert stored_pictures(session) == []


def test_picture_sent_without_its_size_is_also_limited(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)

    def chunks():
        # sem o tamanho declarado, só a leitura limitada barra o corpo
        yield PNG
        yield b"\x00" * MAX_PICTURE_BYTES

    response = client.post(
        f"/api/products/{product.public_id}/picture",
        content=chunks(),
        headers={"Content-Type": "image/png"},
    )

    assert "content-length" not in response.request.headers
    assert response.status_code == status.HTTP_413_CONTENT_TOO_LARGE
    assert stored_pictures(session) == []
