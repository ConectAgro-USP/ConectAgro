from datetime import date
from decimal import Decimal
from unittest.mock import create_autospec
from uuid import uuid4

import pytest

from src.models.farmer import Farmer
from src.models.product import Product, ProductUnit, ProductUpdate
from src.repository.product_repository import ProductInUseError, ProductRepository
from src.services.exceptions import ProductHasPurchasesError
from src.services.product_service import ProductService


def products_with_one_product() -> tuple[ProductRepository, Farmer]:
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
    return products, farmer


def test_removal_locks_the_product_before_reading_its_purchases():
    products, farmer = products_with_one_product()
    products.has_purchases.return_value = False
    service = ProductService(products)

    service.delete_product(uuid4(), farmer)

    steps = [call[0] for call in products.method_calls]
    assert steps == ["get_product_by_public_id", "lock_product", "has_purchases", "delete_product"]


def test_unit_change_locks_the_product_before_checking_its_sales():
    products, farmer = products_with_one_product()
    products.is_unit_locked.return_value = False
    products.save.side_effect = lambda product: product
    service = ProductService(products)

    service.update_product(uuid4(), farmer, ProductUpdate(unit=ProductUnit.DUZIA))

    steps = [call[0] for call in products.method_calls]
    assert steps == ["get_product_by_public_id", "lock_product", "is_unit_locked", "save"]


def test_purchase_saved_during_the_removal_is_explained_as_already_sold():
    products, farmer = products_with_one_product()
    # a compra ainda não existia na conferência, mas já existe quando o banco recusa
    products.has_purchases.side_effect = [False, True]
    products.delete_product.side_effect = ProductInUseError
    service = ProductService(products)

    with pytest.raises(ProductHasPurchasesError):
        service.delete_product(uuid4(), farmer)


def test_integrity_error_that_is_not_about_a_purchase_is_not_hidden():
    products, farmer = products_with_one_product()
    products.has_purchases.return_value = False
    products.delete_product.side_effect = ProductInUseError
    service = ProductService(products)

    with pytest.raises(ProductInUseError):
        service.delete_product(uuid4(), farmer)
