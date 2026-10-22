from collections import Counter
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.interest import Interest, InterestCreate, InterestRead, InterestUpdate
from src.models.product import BUSINESS_TZ, Product

TODAY = datetime.now(BUSINESS_TZ).date()
FUTURE = TODAY + timedelta(days=30)


def create_interest_create_dict(**overrides) -> dict:
    # criação de dicionário para agilizar criação de instâncias de InterestCreate
    data = {
        "quantity": 1,
        "buyer_public_id": uuid4(),
        "product_public_id": uuid4(),
    }
    return {**data, **overrides}


def create_interest_dict(**overrides) -> dict:
    # criação de dicionário para agilizar criação de instâncias de Interest
    data = {
        "quantity": 1,
        "buyer_id": 1,
        "product_id": 1,
    }
    return {**data, **overrides}


def interest_create(**overrides) -> InterestCreate:
    return InterestCreate(**create_interest_create_dict(**overrides))


def test_interest_create_works_for_valid_data():
    interest = interest_create()

    assert Counter(interest.__dict__.keys()) == Counter(
        ["quantity", "buyer_public_id", "product_public_id"]
    )
    assert interest.quantity == 1
    assert isinstance(interest.buyer_public_id, UUID)
    assert isinstance(interest.product_public_id, UUID)


def test_interest_table_generates_fields_correctly():
    interest = Interest(**create_interest_dict())

    assert isinstance(interest.public_id, UUID)
    assert isinstance(interest.created_at, datetime)
    assert interest.updated_at is None


def persisted_apartment(session: Session) -> Apartment:
    apartment = Apartment(
        email="f@example.com",
        name="João",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    session.add(apartment)
    session.commit()
    return apartment


def persisted_buyer(session: Session, apartment_id) -> Buyer:
    buyer = Buyer(email="f@example.com", name="João", apartment_id=apartment_id)
    session.add(buyer)
    session.commit()
    return buyer


def persisted_farmer(session: Session) -> Farmer:
    farmer = Farmer(email="f@example.com", name="João", zip_code="01000-000")
    session.add(farmer)
    session.commit()
    return farmer


def persisted_product(session: Session, farmer_id) -> Product:
    product = Product(
        name="Alface",
        quantity=1,
        price=Decimal("2.03"),
        expiration_date=FUTURE,
        farmer_id=farmer_id,
    )
    session.add(product)
    session.commit()
    return product


def test_interest_table_adds_valid_row_without_error(session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    interest = Interest(
        quantity=1,
        buyer_id=buyer.id,
        product_id=product.id,
    )
    session.add(interest)
    session.commit()

    assert interest.id is not None


def test_interest_table_rejects_non_positive_quantity(session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    session.add(
        Interest(
            quantity=0,
            buyer_id=buyer.id,
            product_id=product.id,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()


def test_interest_table_rejects_duplicated_interest(session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    session.add(
        Interest(
            quantity=1,
            buyer_id=buyer.id,
            product_id=product.id,
        )
    )

    session.add(
        Interest(
            quantity=2,
            buyer_id=buyer.id,
            product_id=product.id,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()


def test_interest_table_accepts_same_buyer_with_different_products(session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    other_product = persisted_product(session, farmer_id=farmer.id)

    session.add(Interest(quantity=1, buyer_id=buyer.id, product_id=product.id))
    session.add(Interest(quantity=1, buyer_id=buyer.id, product_id=other_product.id))
    session.commit()

    assert len(buyer.interests) == 2


def test_interest_read_from_table_doesnt_expose_sensitive_information(session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    interest = Interest(**create_interest_dict(**{"buyer_id": buyer.id, "product_id": product.id}))
    session.add(interest)
    session.commit()

    assert InterestRead.model_validate(interest).public_id == interest.public_id
    assert InterestRead.model_validate(interest).buyer_public_id == buyer.public_id
    assert InterestRead.model_validate(interest).product_public_id == product.public_id


@pytest.mark.parametrize(
    "field, value",
    [
        ("buyer_public_id", 1),
        ("product_public_id", 1),
        ("quantity", -1),
        ("quantity", 0),
        ("quantity", 2**31),
    ],
)
def test_interest_create_rejects_invalid_field(field: str, value: object):
    with pytest.raises(ValidationError) as exc_info:
        interest_create(**{field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


def test_interest_read_hides_internal_id():
    interest_read = InterestRead(
        quantity=1,
        public_id=uuid4(),
        buyer_public_id=uuid4(),
        product_public_id=uuid4(),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        id=1,
    )

    assert "id" not in interest_read.model_dump()


def test_interest_read_rejects_wrong_type():
    data = {
        **interest_create().model_dump(),
        "public_id": 1,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    with pytest.raises(ValidationError):
        InterestRead(**data)


@pytest.mark.parametrize(
    "field, value",
    [
        ("quantity", -1),
        ("quantity", 0),
        ("quantity", None),
        ("quantity", 2**31),
    ],
)
def test_interest_update_rejects_invalid_field(field: str, value: object):
    with pytest.raises(ValidationError) as exc_info:
        InterestUpdate(**{field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


def test_interest_table_fills_updated_at_on_update(session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    interest = Interest(quantity=1, buyer_id=buyer.id, product_id=product.id)

    session.add(interest)
    session.commit()
    assert interest.updated_at is None

    interest.quantity = 2
    session.add(interest)
    session.commit()

    assert interest.updated_at is not None


def test_interest_update_ignores_unknown_fields():
    interest_update = InterestUpdate(
        quantity=1, expiration_date=FUTURE, created_at=datetime.now(UTC)
    )

    assert interest_update.model_dump(exclude_unset=True) == {"quantity": 1}


@pytest.mark.parametrize("owner", ["buyer", "product"])
def test_deleting_owner_deletes_its_interests(owner: str, session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    interest = Interest(quantity=1, buyer_id=buyer.id, product_id=product.id)

    session.add(interest)
    session.commit()
    interest_id = interest.id

    session.delete(buyer if owner == "buyer" else product)
    session.commit()

    assert session.get(Interest, interest_id) is None


def test_deleting_interest_doesnt_delete_its_owners(session: Session):
    apartment = persisted_apartment(session)
    farmer = persisted_farmer(session)
    buyer = persisted_buyer(session, apartment_id=apartment.id)
    product = persisted_product(session, farmer_id=farmer.id)

    interest = Interest(quantity=1, buyer_id=buyer.id, product_id=product.id)

    session.add(interest)
    session.commit()
    buyer_id = interest.buyer_id
    product_id = interest.product_id

    session.delete(interest)
    session.commit()

    assert session.get(Product, product_id) is not None
    assert session.get(Buyer, buyer_id) is not None
