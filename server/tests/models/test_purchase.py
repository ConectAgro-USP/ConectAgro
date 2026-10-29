from datetime import UTC, datetime
from decimal import Decimal
import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.product import (
    Product,
    Purchase,
    PurchasePart,
    PurchaseProduct,
    PurchaseStatus,
)

sqlite_file_name = "sqlite:///:memory:"
engine = create_engine(sqlite_file_name, echo=False)

@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

def test_create_valid_purchase(session: Session):
    purchase = Purchase(
        apartment_id=1,
        expected_delivery_date=datetime(2026, 12, 1, tzinfo=UTC)
    )
    session.add(purchase)
    session.commit()
    session.refresh(purchase)

    part = PurchasePart(
        purchase_id=purchase.id,
        farmer_id=2,
        status=PurchaseStatus.EM_PROGRESSO,
    )
    session.add(part)
    session.commit()
    session.refresh(part)

    assert purchase.id is not None
    assert purchase.status == PurchaseStatus.EM_PROGRESSO
    assert part.farmer_id == 2

def test_purchase_part_status_validation():
    with pytest.raises(ValidationError):
        PurchasePart.model_validate({
            "purchase_id": 1,
            "farmer_id": 2,
            "status": "PENDENTE",
            "expected_delivery_date": datetime(2026, 12, 1, tzinfo=UTC),
        })

def test_purchase_product_validation():
    with pytest.raises(ValidationError):
        PurchaseProduct.model_validate({
            "purchase_part_id": 1,
            "product_id": 1,
            "quantity": 0,
            "unit_price": 10.50,
        })

    with pytest.raises(ValidationError):
        PurchaseProduct.model_validate({
            "purchase_part_id": 1,
            "product_id": 1,
            "quantity": 5,
            "unit_price": -5.00,
        })

def test_purchase_products_relationship(session: Session):
    purchase = Purchase(
        apartment_id=1,
        expected_delivery_date=datetime(2026, 12, 1, tzinfo=UTC),
    )
    session.add(purchase)
    session.commit()

    part = PurchasePart(
        purchase_id=purchase.id,
        farmer_id=1,
    )
    session.add(part)
    session.commit()

    pp1 = PurchaseProduct(
        purchase_part_id=part.id, product_id=10, quantity=2, unit_price=15.0
    )
    pp2 = PurchaseProduct(
        purchase_part_id=part.id, product_id=20, quantity=1, unit_price=30.0
    )

    session.add(pp1)
    session.add(pp2)
    session.commit()

    session.refresh(part)

    assert len(part.items) == 2
    assert part.items[0].unit_price == 15.0
    assert part.items[1].quantity == 1


def test_purchase_part_uniqueness_constraint(session: Session):
    purchase = Purchase(
        apartment_id=1,
        expected_delivery_date=datetime(2026, 12, 1, tzinfo=UTC),
    )
    session.add(purchase)
    session.commit()

    part1 = PurchasePart(purchase_id=purchase.id, farmer_id=1)
    session.add(part1)
    session.commit()

    part2 = PurchasePart(purchase_id=purchase.id, farmer_id=1)
    session.add(part2)

    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize(
    "part_statuses, expected_status",
    [
        (
            [PurchaseStatus.ENTREGUE, PurchaseStatus.ENTREGUE],
            PurchaseStatus.ENTREGUE,
        ),
        (
            [PurchaseStatus.CANCELADA, PurchaseStatus.CANCELADA],
            PurchaseStatus.CANCELADA,
        ),
        (
            [PurchaseStatus.ENTREGUE, PurchaseStatus.CANCELADA],
            PurchaseStatus.EM_PROGRESSO,
        ),
        (
            [PurchaseStatus.EM_PROGRESSO, PurchaseStatus.ENTREGUE],
            PurchaseStatus.EM_PROGRESSO,
        ),
    ],
)
def test_purchase_status_derivation(
    session: Session,
    part_statuses: list[PurchaseStatus],
    expected_status: PurchaseStatus,
):
    purchase = Purchase(
        apartment_id=1,
        expected_delivery_date=datetime(2026, 12, 1, tzinfo=UTC),
    )
    session.add(purchase)
    session.commit()

    for farmer_id, status in enumerate(part_statuses, start=1):
        part = PurchasePart(
            purchase_id=purchase.id,
            farmer_id=farmer_id,
            status=status,
        )
        session.add(part)

    session.commit()
    session.refresh(purchase)

    assert purchase.status == expected_status