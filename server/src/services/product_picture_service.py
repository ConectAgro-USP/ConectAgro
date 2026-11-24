from datetime import UTC, datetime
from hashlib import sha256
from uuid import UUID

from src.models.farmer import Farmer
from src.models.product import Product
from src.models.product_picture import ProductPicture
from src.repository.product_picture_repository import ProductPictureRepository
from src.repository.product_repository import ProductRepository
from src.services.exceptions import (
    NotProductOwnerError,
    PictureTooLargeError,
    ProductNotFoundError,
    ProductPictureNotFoundError,
    UnsupportedPictureTypeError,
)

MAX_PICTURE_BYTES = 1024 * 1024
PICTURE_VERSION_LENGTH = 12


def picture_type(data: bytes) -> str | None:
    # o tipo vem dos bytes iniciais, e não do que o navegador declarou
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def picture_url(public_id: UUID, etag: str) -> str:
    # a versão muda com a foto, e o navegador não mostra a antiga do cache
    return f"/api/products/{public_id}/picture?v={etag[:PICTURE_VERSION_LENGTH]}"


class ProductPictureService:
    def __init__(self, products: ProductRepository, pictures: ProductPictureRepository):
        self.products = products
        self.pictures = pictures

    def save_picture(
        self, public_id: UUID, farmer: Farmer, data: bytes, content_type: str | None
    ) -> Product:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        if product.farmer_id != farmer.id:
            raise NotProductOwnerError
        if len(data) > MAX_PICTURE_BYTES:
            raise PictureTooLargeError
        detected = picture_type(data)
        if detected is None or detected != content_type:
            raise UnsupportedPictureTypeError

        etag = sha256(data).hexdigest()
        # trava o produto, para dois envios não criarem duas fotos
        self.products.lock_product(product.id)
        picture = self.pictures.get_by_product_id(product.id)
        if picture is None:
            picture = ProductPicture(product_id=product.id)
        picture.data = data
        picture.content_type = detected
        picture.etag = etag
        picture.updated_at = datetime.now(UTC)
        product.picture_url = picture_url(product.public_id, etag)
        return self.pictures.save(picture, product)

    def get_picture(self, public_id: UUID) -> ProductPicture:
        found = self.pictures.get_with_product(public_id)
        if found is None:
            raise ProductPictureNotFoundError
        picture, product = found
        # um link externo colado depois substitui a foto guardada
        if product.picture_url != picture_url(product.public_id, picture.etag):
            raise ProductPictureNotFoundError
        return picture
