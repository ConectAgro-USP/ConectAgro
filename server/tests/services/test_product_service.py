from datetime import date
from decimal import Decimal
from unittest.mock import create_autospec
from uuid import uuid4

import pytest

from src.models.farmer import Farmer
from src.models.product import Product
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
    )
    products = create_autospec(ProductRepository, instance=True)
    products.get_product_by_public_id.return_value = product
    return products, farmer


def test_purchase_saved_during_the_removal_is_explained_as_already_sold():
    products, farmer = products_with_one_product()
    # a compra ainda não existia na conferência, mas já existe quando o banco recusa
    products.has_purchases.side_effect = [False, True]
    products.delete_product.side_effect = ProductInUseError

    with pytest.raises(ProductHasPurchasesError):
        ProductService(products).delete_product(uuid4(), farmer)


def test_integrity_error_that_is_not_about_a_purchase_is_not_hidden():
    products, farmer = products_with_one_product()
    products.has_purchases.return_value = False
    products.delete_product.side_effect = ProductInUseError

    with pytest.raises(ProductInUseError):
        ProductService(products).delete_product(uuid4(), farmer)
