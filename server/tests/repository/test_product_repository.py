from datetime import date
from decimal import Decimal
from unittest.mock import create_autospec

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from src.models.product import Product
from src.repository.product_repository import ProductInUseError, ProductRepository


def lettuce() -> Product:
    return Product(
        id=1, name="Alface", quantity=1, price=Decimal("2.50"), expiration_date=date(2026, 12, 1)
    )


def test_delete_product_removes_and_commits():
    session = create_autospec(Session, instance=True)
    product = lettuce()

    ProductRepository(session).delete_product(product)

    session.delete.assert_called_once_with(product)
    session.commit.assert_called_once_with()
    session.rollback.assert_not_called()


def test_delete_product_turns_an_integrity_error_into_product_in_use_error():
    session = create_autospec(Session, instance=True)
    integrity_error = IntegrityError("DELETE FROM products", {}, Exception("foreign key"))
    session.commit.side_effect = integrity_error

    repository = ProductRepository(session)
    product = lettuce()

    with pytest.raises(ProductInUseError) as caught:
        repository.delete_product(product)

    session.rollback.assert_called_once_with()
    assert caught.value.__cause__ is integrity_error
