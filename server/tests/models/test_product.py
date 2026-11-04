from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product, ProductCreate, ProductRead, ProductUpdate
from src.models.user import User

TODAY = datetime.now(BUSINESS_TZ).date()
FUTURE = TODAY + timedelta(days=30)
PAST = TODAY - timedelta(days=1)


def product_create(**overrides) -> ProductCreate:
    data = {
        "name": "Alface",
        "description": "Alface crespa",
        "picture_url": "https://example.com/alface.png",
        "quantity": 1,
        "price": "2.03",
        "expiration_date": FUTURE,
        "farmer_public_id": uuid4(),
    }
    return ProductCreate(**{**data, **overrides})


def test_product_table_generates_public_id_and_created_at():
    product = Product(name="Alface", quantity=1, price=Decimal("2.03"), expiration_date=FUTURE)

    assert isinstance(product.public_id, UUID)
    assert isinstance(product.created_at, datetime)

@pytest.fixture
def farmer(session: Session) -> Farmer:
    user = User(email="farmer@example.com", name="João",
                picture_url="https://example.com/photo.jpg", cellphone = "11957249062",
                homephone="1140028922")
    session.add(user)
    session.commit()
    session.refresh(user)

    farmer = Farmer(user_id = user.id, zip_code = "01000-000")
    session.add(farmer)
    session.commit()
    session.refresh(farmer)
    return farmer


def test_product_table_rejects_negative_quantity(session: Session, farmer : Farmer):
    session.add(
        Product(
            name="Alface",
            quantity=-1,
            price=Decimal("2.03"),
            expiration_date=FUTURE,
            farmer_id=farmer.user.id,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()


def test_product_read_from_table_exposes_farmer_public_id(session: Session, farmer : Farmer):
    product = Product(
        name="Alface", quantity=1, price=Decimal("2.03"), expiration_date=FUTURE,
        farmer_id=farmer.user.id
    )
    session.add(product)
    session.commit()

    assert ProductRead.model_validate(product).farmer_public_id == farmer.public_id


def test_product_create():
    product = product_create()

    assert product.price == Decimal("2.03")
    assert product.expiration_date == FUTURE
    assert isinstance(product.farmer_public_id, UUID)


def test_product_create_accepts_today():
    assert product_create(expiration_date=TODAY).expiration_date == TODAY


@pytest.mark.parametrize(
    "field, value",
    [
        ("name", ""),
        ("description", 1),
        ("quantity", -1),
        ("quantity", 2**31),
        ("price", "-2.03"),
        ("price", "1.234"),
        ("expiration_date", PAST),
    ],
)
def test_product_create_rejects_invalid_field(field: str, value: object):
    with pytest.raises(ValidationError) as exc_info:
        product_create(**{field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


def test_product_create_explains_expired_product():
    with pytest.raises(ValidationError, match="Não é possível cadastrar produto vencido"):
        product_create(expiration_date=PAST)


def test_product_read_hides_internal_id():
    product_read = ProductRead(
        **product_create().model_dump(),
        public_id=uuid4(),
        created_at=datetime.now(UTC),
        id=1,
    )

    assert "id" not in product_read.model_dump()


def test_product_read_rejects_wrong_type():
    data = {
        **product_create().model_dump(),
        "name": 1,
        "public_id": uuid4(),
        "created_at": datetime.now(UTC),
    }

    with pytest.raises(ValidationError):
        ProductRead(**data)


@pytest.mark.parametrize(
    "field, value",
    [
        ("price", -1),
        ("quantity", -1),
        ("quantity", 2**31),
        ("expiration_date", PAST),
        ("name", None),
        ("quantity", None),
        ("price", None),
        ("expiration_date", None),
    ],
)
def test_product_update_rejects_invalid_field(field: str, value: object):
    with pytest.raises(ValidationError) as exc_info:
        ProductUpdate(**{field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


def test_product_update_accepts_null_for_nullable_fields():
    product_update = ProductUpdate(description=None)

    assert product_update.model_dump(exclude_unset=True) == {"description": None}


def test_expiration_uses_brazilian_date(monkeypatch: pytest.MonkeyPatch):
    class LateEveningInBrazil(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 10, 13, 1, 30, tzinfo=UTC).astimezone(tz)

    monkeypatch.setattr("src.models.product.datetime", LateEveningInBrazil)

    assert product_create(expiration_date=date(2026, 10, 12)).expiration_date == date(2026, 10, 12)


def test_product_update_ignores_unknown_fields():
    product_update = ProductUpdate(expiration_date=FUTURE, created_at=datetime.now(UTC))

    assert product_update.model_dump(exclude_unset=True) == {"expiration_date": FUTURE}


def test_product_update_explains_expired_product():
    with pytest.raises(ValidationError, match="Atualização faz com que o produto esteja fora"):
        ProductUpdate(expiration_date=PAST)
