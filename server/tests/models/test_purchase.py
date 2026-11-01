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
from src.models.purchase import (
    Purchase,
    PurchasePart,
    PurchaseProduct,
    PurchaseRead,
    PurchaseStatus,
)
from src.models.user import User

FUTURE = date(2030, 1, 1)


@pytest.fixture
def apartment(session: Session) -> Apartment:
    user = User(
        email="manager@example.com",
        name="Matheus",
        picture_url="https://example.com/photo.jpg",
        cellphone="11944644502",
        homephone="1124644502",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    apartment = Apartment(
        manager_id=user.id,
        zip_code="01000-000",
        building_name="Edifício Araraquara",
        building_cnpj="12.345.678/0001-90",
    )
    session.add(apartment)
    session.commit()
    session.refresh(apartment)
    return apartment


@pytest.fixture
def farmer(session: Session) -> Farmer:
    user = User(
        email="farmer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        cellphone="11957249062",
        homephone="1140028922",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    farmer = Farmer(user_id=user.id, zip_code="01000-000")
    session.add(farmer)
    session.commit()
    session.refresh(farmer)
    return farmer


@pytest.fixture
def product(session: Session, farmer: Farmer) -> Product:
    product = Product(
        name="Alface",
        quantity=10,
        price=Decimal("2.50"),
        expiration_date=FUTURE,
        farmer_id=farmer.user_id,
    )
    session.add(product)
    session.commit()
    return product


@pytest.fixture
def purchase(session: Session, apartment: Apartment) -> Purchase:
    purchase = Purchase(apartment_id=apartment.id, expected_delivery_date=FUTURE)
    session.add(purchase)
    session.commit()
    return purchase


@pytest.fixture
def purchase_part(session: Session, purchase: Purchase, farmer: Farmer) -> PurchasePart:
    part = PurchasePart(purchase_id=purchase.id, farmer_id=farmer.id)
    session.add(part)
    session.commit()
    return part


def test_purchase_starts_in_progress_with_generated_fields(purchase: Purchase):
    assert purchase.id is not None
    assert isinstance(purchase.public_id, UUID)
    assert purchase.status is PurchaseStatus.EM_PROGRESSO
    assert purchase.created_at is not None
    assert purchase.closed_at is None


def test_purchase_links_apartment_and_farmer(
    session: Session, purchase: Purchase, apartment: Apartment, farmer: Farmer
):
    part = PurchasePart(purchase_id=purchase.id, farmer_id=farmer.id)
    session.add(part)
    session.commit()
    session.refresh(apartment)
    session.refresh(farmer)

    assert apartment.purchases == [purchase]
    assert farmer.purchase_parts == [part]


def test_purchase_part_uniqueness_constraint(
    session: Session, purchase: Purchase, farmer: Farmer
):
    part1 = PurchasePart(purchase_id=purchase.id, farmer_id=farmer.id)
    session.add(part1)
    session.commit()

    part2 = PurchasePart(purchase_id=purchase.id, farmer_id=farmer.id)
    session.add(part2)

    with pytest.raises(IntegrityError):
        session.commit()


def test_purchase_accepts_multiple_products(
    session: Session, purchase_part: PurchasePart, product: Product, farmer: Farmer
):
    other_product = Product(
        name="Tomate",
        quantity=5,
        price=Decimal("4.00"),
        expiration_date=FUTURE,
        farmer_id=farmer.user_id,
    )
    session.add(other_product)
    session.commit()

    session.add_all(
        [
            PurchaseProduct(
                purchase_part_id=purchase_part.id,
                product_id=product.id,
                quantity=2,
                unit_price=product.price,
            ),
            PurchaseProduct(
                purchase_part_id=purchase_part.id,
                product_id=other_product.id,
                quantity=1,
                unit_price=other_product.price,
            ),
        ]
    )
    session.commit()
    session.refresh(purchase_part)

    assert len(purchase_part.purchase_products) == 2


def test_purchase_product_keeps_unit_price_when_product_price_changes(
    session: Session, purchase_part: PurchasePart, product: Product
):
    item = PurchaseProduct(
        purchase_part_id=purchase_part.id,
        product_id=product.id,
        quantity=2,
        unit_price=product.price,
    )
    session.add(item)
    session.commit()

    product.price = Decimal("9.99")
    session.commit()

    session.refresh(item)
    assert item.unit_price == Decimal("2.50")
    assert item.product.price == Decimal("9.99")


def test_purchase_product_table_rejects_duplicated_product(
    session: Session, purchase_part: PurchasePart, product: Product
):
    session.add_all(
        [
            PurchaseProduct(
                purchase_part_id=purchase_part.id,
                product_id=product.id,
                quantity=1,
                unit_price=product.price,
            ),
            PurchaseProduct(
                purchase_part_id=purchase_part.id,
                product_id=product.id,
                quantity=2,
                unit_price=product.price,
            ),
        ]
    )
    with pytest.raises(IntegrityError):
        session.commit()


def test_deleting_purchase_deletes_its_parts_and_products(
    session: Session, purchase: Purchase, purchase_part: PurchasePart, product: Product
):
    item = PurchaseProduct(
        purchase_part_id=purchase_part.id,
        product_id=product.id,
        quantity=1,
        unit_price=product.price,
    )
    session.add(item)
    session.commit()

    session.delete(purchase)
    session.commit()

    assert session.get(PurchasePart, purchase_part.id) is None
    assert session.get(PurchaseProduct, (purchase_part.id, product.id)) is None
    assert session.get(Product, product.id) is not None


def test_purchase_part_status_validation():
    with pytest.raises(ValidationError):
        PurchasePart.model_validate(
            {
                "purchase_id": 1,
                "farmer_id": 2,
                "status": "PENDENTE",
            }
        )


@pytest.mark.parametrize("field, value", [("quantity", 0), ("unit_price", "-5.00")])
def test_purchase_product_model_validate_rejects_invalid_field(field: str, value: object):
    data = {"purchase_part_id": 1, "product_id": 1, "quantity": 1, "unit_price": "1.00"}

    with pytest.raises(ValidationError) as exc_info:
        PurchaseProduct.model_validate({**data, field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize(
    "part_statuses, expected_status",
    [
        ([PurchaseStatus.ENTREGUE, PurchaseStatus.ENTREGUE], PurchaseStatus.ENTREGUE),
        ([PurchaseStatus.CANCELADA, PurchaseStatus.CANCELADA], PurchaseStatus.CANCELADA),
        ([PurchaseStatus.ENTREGUE, PurchaseStatus.CANCELADA], PurchaseStatus.EM_PROGRESSO),
        ([PurchaseStatus.EM_PROGRESSO, PurchaseStatus.ENTREGUE], PurchaseStatus.EM_PROGRESSO),
    ],
)
def test_purchase_status_derivation(
    session: Session,
    apartment: Apartment,
    farmer: Farmer,
    part_statuses: list[PurchaseStatus],
    expected_status: PurchaseStatus,
):
    purchase = Purchase(apartment_id=apartment.id, expected_delivery_date=FUTURE)
    session.add(purchase)
    session.commit()

    for i, status in enumerate(part_statuses, start=1):
        u = User(email=f"farmer{i}@example.com", name=f"Farmer {i}", cellphone="11900000000")
        session.add(u)
        session.commit()
        f = Farmer(user_id=u.id, zip_code="01000-000")
        session.add(f)
        session.commit()

        part = PurchasePart(purchase_id=purchase.id, farmer_id=f.id, status=status)
        session.add(part)

    session.commit()
    session.refresh(purchase)

    assert purchase.status == expected_status


def test_purchase_read_exposes_public_ids_and_purchase_products(
    session: Session, purchase: Purchase, apartment: Apartment, farmer: Farmer, product: Product
):
    part = PurchasePart(purchase_id=purchase.id, farmer_id=farmer.id)
    session.add(part)
    session.commit()

    item = PurchaseProduct(
        purchase_part_id=part.id, product_id=product.id, quantity=3, unit_price=product.price
    )
    session.add(item)
    session.commit()

    session.refresh(purchase)
    read = PurchaseRead.model_validate(purchase)

    assert read.public_id == purchase.public_id
    assert read.apartment_public_id == apartment.public_id
    assert len(read.purchase_parts) == 1
    assert read.purchase_parts[0].farmer_public_id == farmer.public_id
    assert [item.product_public_id for item in read.purchase_parts[0].purchase_products] == [
        product.public_id
    ]