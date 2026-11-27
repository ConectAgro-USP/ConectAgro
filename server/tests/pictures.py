from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.models.product import Product
from src.models.product_picture import ProductPicture

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32


def upload(
    client: TestClient,
    product: Product,
    data: bytes = PNG,
    content_type: str = "image/png",
    ip: str | None = None,
):
    headers = {"Content-Type": content_type}
    if ip is not None:
        headers["X-Forwarded-For"] = f"{ip}, 10.0.0.1"
    return client.post(f"/api/products/{product.public_id}/picture", content=data, headers=headers)


def stored_pictures(session: Session) -> list[ProductPicture]:
    return list(session.exec(select(ProductPicture)).all())
