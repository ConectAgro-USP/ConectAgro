from collections import Counter
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.interest import Interest, InterestCreate, InterestRead, InterestUpdate
from src.models.product import BUSINESS_TZ, Product

TODAY = datetime.now(BUSINESS_TZ).date()
FUTURE = TODAY + timedelta(days=30)


@pytest.fixture
def buyer(session: Session) -> Buyer:
    buyer = Buyer(email="buyer@example.com", name="João")
    session.add(buyer)
    session.commit()
    return buyer


@pytest.fixture
def product(session: Session) -> Product:
    farmer = Farmer(email="farmer@example.com", name="Maria", zip_code="01000-000")
    product = Product(
        name="Alface", quantity=1, price=Decimal("2.03"), expiration_date=FUTURE, farmer=farmer
    )
    session.add(product)
    session.commit()
    return product


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


def test_interest_table_adds_valid_row_without_error(
    session: Session, buyer: Buyer, product: Product
):
    interest = Interest(
        quantity=1,
        buyer_id=buyer.id,
        product_id=product.id,
    )
    session.add(interest)
    session.commit()

    assert interest.id is not None


def test_interest_table_rejects_non_positive_quantity(
    session: Session, buyer: Buyer, product: Product
):
    session.add(
        Interest(
            quantity=0,
            buyer_id=buyer.id,
            product_id=product.id,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()


def test_interest_table_rejects_duplicated_interest(
    session: Session, buyer: Buyer, product: Product
):
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


def test_interest_table_accepts_same_buyer_with_different_products(
    session: Session, buyer: Buyer, product: Product
):
    other_product = Product(
        name="Tomate",
        quantity=1,
        price=Decimal("4.50"),
        expiration_date=FUTURE,
        farmer_id=product.farmer_id,
    )
    session.add(other_product)
    session.commit()

    session.add(Interest(quantity=1, buyer_id=buyer.id, product_id=product.id))
    session.add(Interest(quantity=1, buyer_id=buyer.id, product_id=other_product.id))
    session.commit()

    assert len(buyer.interests) == 2


def test_interest_read_from_table_doesnt_expose_sensitive_information(
    session: Session, buyer: Buyer, product: Product
):
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


def test_interest_table_fills_updated_at_on_update(
    session: Session, buyer: Buyer, product: Product
):
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
def test_deleting_owner_deletes_its_interests(
    owner: str, session: Session, buyer: Buyer, product: Product
):
    interest = Interest(quantity=1, buyer_id=buyer.id, product_id=product.id)

    session.add(interest)
    session.commit()
    interest_id = interest.id

    session.delete(buyer if owner == "buyer" else product)
    session.commit()

    assert session.get(Interest, interest_id) is None


def test_deleting_interest_doesnt_delete_its_owners(
    session: Session, buyer: Buyer, product: Product
):
    interest = Interest(quantity=1, buyer_id=buyer.id, product_id=product.id)

    session.add(interest)
    session.commit()
    buyer_id = interest.buyer_id
    product_id = interest.product_id

    session.delete(interest)
    session.commit()

    assert session.get(Product, product_id) is not None
    assert session.get(Buyer, buyer_id) is not None
