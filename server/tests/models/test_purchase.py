from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.purchase import Purchase, PurchaseProduct, PurchaseRead, PurchaseStatus

FUTURE = date(2030, 1, 1)


@pytest.fixture
def apartment(session: Session) -> Apartment:
    apartment = Apartment(
        email="apartment@example.com",
        name="Edifício Araraquara",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )
    session.add(apartment)
    session.commit()
    return apartment


@pytest.fixture
def farmer(session: Session) -> Farmer:
    farmer = Farmer(email="farmer@example.com", name="Maria", zip_code="01000-000")
    session.add(farmer)
    session.commit()
    return farmer


@pytest.fixture
def product(session: Session, farmer: Farmer) -> Product:
    product = Product(
        name="Alface", quantity=10, price=Decimal("2.50"), expiration_date=FUTURE, farmer=farmer
    )
    session.add(product)
    session.commit()
    return product


@pytest.fixture
def purchase(session: Session, apartment: Apartment, farmer: Farmer) -> Purchase:
    purchase = Purchase(apartment=apartment, farmer=farmer, expected_delivery_date=FUTURE)
    session.add(purchase)
    session.commit()
    return purchase


def test_purchase_starts_in_progress_with_generated_fields(purchase: Purchase):
    assert purchase.id is not None
    assert isinstance(purchase.public_id, UUID)
    assert purchase.status is PurchaseStatus.EM_PROGRESSO
    assert purchase.created_at is not None
    assert purchase.closed_at is None


def test_purchase_links_apartment_and_farmer(
    purchase: Purchase, apartment: Apartment, farmer: Farmer
):
    assert apartment.purchases == [purchase]
    assert farmer.purchases == [purchase]


def test_purchase_accepts_multiple_products(
    session: Session, purchase: Purchase, product: Product, farmer: Farmer
):
    other_product = Product(
        name="Tomate", quantity=5, price=Decimal("4.00"), expiration_date=FUTURE, farmer=farmer
    )
    session.add(other_product)
    session.add_all(
        [
            PurchaseProduct(
                purchase=purchase, product=product, quantity=2, unit_price=product.price
            ),
            PurchaseProduct(
                purchase=purchase, product=other_product, quantity=1, unit_price=other_product.price
            ),
        ]
    )
    session.commit()

    assert len(purchase.purchase_products) == 2


def test_purchase_product_keeps_unit_price_when_product_price_changes(
    session: Session, purchase: Purchase, product: Product
):
    session.add(
        PurchaseProduct(purchase=purchase, product=product, quantity=2, unit_price=product.price)
    )
    session.commit()

    product.price = Decimal("9.99")
    session.commit()

    item = purchase.purchase_products[0]
    assert item.unit_price == Decimal("2.50")
    assert item.product.price == Decimal("9.99")


def test_purchase_product_table_rejects_duplicated_product(
    session: Session, purchase: Purchase, product: Product
):
    session.add_all(
        [
            PurchaseProduct(
                purchase=purchase, product=product, quantity=1, unit_price=product.price
            ),
            PurchaseProduct(
                purchase=purchase, product=product, quantity=2, unit_price=product.price
            ),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()


def test_deleting_purchase_deletes_its_products(
    session: Session, purchase: Purchase, product: Product
):
    session.add(
        PurchaseProduct(purchase=purchase, product=product, quantity=1, unit_price=product.price)
    )
    session.commit()

    session.delete(purchase)
    session.commit()

    assert session.get(PurchaseProduct, (purchase.id, product.id)) is None
    assert session.get(Product, product.id) is not None


def test_purchase_status_round_trips_as_enum(session: Session, purchase: Purchase):
    purchase.status = PurchaseStatus.ENTREGUE
    session.commit()

    assert purchase.status is PurchaseStatus.ENTREGUE


def test_purchase_model_validate_rejects_unknown_status():
    with pytest.raises(ValidationError) as exc_info:
        Purchase.model_validate(
            {
                "apartment_id": 1,
                "farmer_id": 1,
                "status": "PENDENTE",
                "expected_delivery_date": FUTURE,
            }
        )

    assert exc_info.value.errors()[0]["loc"] == ("status",)


@pytest.mark.parametrize("field, value", [("quantity", 0), ("unit_price", "-5.00")])
def test_purchase_product_model_validate_rejects_invalid_field(field: str, value: object):
    data = {"purchase_id": 1, "product_id": 1, "quantity": 1, "unit_price": "1.00"}

    with pytest.raises(ValidationError) as exc_info:
        PurchaseProduct.model_validate({**data, field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


def test_purchase_read_exposes_public_ids_and_purchase_products(
    session: Session, purchase: Purchase, apartment: Apartment, farmer: Farmer, product: Product
):
    session.add(
        PurchaseProduct(purchase=purchase, product=product, quantity=3, unit_price=product.price)
    )
    session.commit()

    read = PurchaseRead.model_validate(purchase)

    assert read.public_id == purchase.public_id
    assert read.apartment_public_id == apartment.public_id
    assert read.farmer_public_id == farmer.public_id
    assert [item.product_public_id for item in read.purchase_products] == [product.public_id]


def test_purchase_read_hides_internal_id(purchase: Purchase):
    assert "id" not in PurchaseRead.model_validate(purchase).model_dump()
