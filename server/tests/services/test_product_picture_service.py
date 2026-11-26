from datetime import date
from decimal import Decimal
from unittest.mock import Mock, create_autospec
from uuid import uuid4

from src.models.farmer import Farmer
from src.models.product import Product
from src.repository.product_picture_repository import ProductPictureRepository
from src.repository.product_repository import ProductRepository
from src.services.product_picture_service import ProductPictureService

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16


def test_saving_a_picture_locks_the_product_before_reading_its_picture():
    farmer = Farmer(id=1, user_id=1, zip_code="01310200")
    product = Product(
        id=1,
        name="Alface",
        quantity=1,
        price=Decimal("2.50"),
        expiration_date=date(2026, 12, 1),
        farmer_id=farmer.id,
        farmer=farmer,
    )
    products = create_autospec(ProductRepository, instance=True)
    products.get_product_by_public_id.return_value = product
    products.is_unit_locked.return_value = False
    pictures = create_autospec(ProductPictureRepository, instance=True)
    pictures.get_by_product_id.return_value = None
    pictures.save.return_value = product
    calls = Mock()
    calls.attach_mock(products, "products")
    calls.attach_mock(pictures, "pictures")

    ProductPictureService(products, pictures).save_picture(uuid4(), farmer, PNG, "image/png")

    steps = [call[0] for call in calls.method_calls]
    assert steps == [
        "products.get_product_by_public_id",
        "products.lock_product",
        "pictures.get_by_product_id",
        "pictures.save",
        "products.is_unit_locked",
    ]
