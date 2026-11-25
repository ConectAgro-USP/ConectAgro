from uuid import uuid4

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.farmer import Farmer
from tests.helpers import add_product
from tests.test_product_picture_upload import JPEG, PNG, stored_pictures, upload


def test_picture_is_served_with_its_type_and_cache_headers(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)
    picture_url = upload(client, product, JPEG, "image/jpeg").json()["picture_url"]

    response = client.get(picture_url)

    assert response.status_code == status.HTTP_200_OK
    assert response.content == JPEG
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "public, max-age=86400"
    assert response.headers["x-content-type-options"] == "nosniff"
    etag = response.headers["etag"]
    assert etag.startswith('"') and etag.endswith('"')
    assert picture_url.endswith(f"?v={etag[1:13]}")


def test_matching_etag_answers_not_modified(client: TestClient, session: Session, farmer: Farmer):
    product = add_product(session, farmer)
    picture_url = upload(client, product, PNG).json()["picture_url"]
    etag = client.get(picture_url).headers["etag"]

    same = client.get(picture_url, headers={"If-None-Match": etag})
    weak_in_list = client.get(picture_url, headers={"If-None-Match": f'"outra", W/{etag}'})
    other = client.get(picture_url, headers={"If-None-Match": '"outra"'})

    assert same.status_code == status.HTTP_304_NOT_MODIFIED
    assert same.content == b""
    assert same.headers["etag"] == etag
    assert weak_in_list.status_code == status.HTTP_304_NOT_MODIFIED
    assert other.status_code == status.HTTP_200_OK
    assert other.content == PNG


def test_new_picture_changes_the_etag(client: TestClient, session: Session, farmer: Farmer):
    product = add_product(session, farmer)
    first_url = upload(client, product, PNG).json()["picture_url"]
    old_etag = client.get(first_url).headers["etag"]
    new_url = upload(client, product, JPEG, "image/jpeg").json()["picture_url"]

    response = client.get(new_url, headers={"If-None-Match": old_etag})

    assert response.status_code == status.HTTP_200_OK
    assert response.content == JPEG


def test_product_without_stored_picture_has_none_to_serve(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer, picture_url="https://example.com/alface.png")

    missing_picture = client.get(f"/api/products/{product.public_id}/picture")
    missing_product = client.get(f"/api/products/{uuid4()}/picture")

    assert missing_picture.status_code == status.HTTP_404_NOT_FOUND
    assert missing_picture.json()["detail"] == "Foto não encontrada"
    assert missing_product.status_code == status.HTTP_404_NOT_FOUND


def test_external_link_pasted_later_replaces_the_stored_picture(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)
    picture_url = upload(client, product, PNG).json()["picture_url"]

    client.patch(f"/api/products/{product.public_id}", json={"picture_url": "https://x.com/a.png"})

    assert client.get(picture_url).status_code == status.HTTP_404_NOT_FOUND


def test_saving_the_product_with_the_same_picture_url_keeps_the_picture(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)
    picture_url = upload(client, product, PNG).json()["picture_url"]

    patched = client.patch(
        f"/api/products/{product.public_id}", json={"name": "Alface", "picture_url": picture_url}
    )

    assert patched.json()["picture_url"] == picture_url
    assert client.get(picture_url).content == PNG


def test_deleting_the_product_deletes_its_picture(
    client: TestClient, session: Session, farmer: Farmer
):
    product = add_product(session, farmer)
    other = add_product(session, farmer, name="Batata")
    upload(client, product, PNG)
    upload(client, other, JPEG, "image/jpeg")

    response = client.delete(f"/api/products/{product.public_id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert [picture.data for picture in stored_pictures(session)] == [JPEG]
