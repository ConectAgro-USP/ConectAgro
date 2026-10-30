from collections import Counter
from datetime import UTC, date, datetime
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.purchase import Purchase
from src.models.review import Review, ReviewCreate, ReviewRead, ReviewUpdate
from src.models.user import User

FUTURE = date(2030, 1, 1)


@pytest.fixture
def farmer(session: Session) -> Farmer:
    user = User(
        email="farmer@example.com",
        name="João",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    farmer = Farmer(
        zip_code="01000-000",
        user_id=user.id,
    )
    session.add(farmer)
    session.commit()
    session.refresh(farmer)

    return farmer


@pytest.fixture
def apartment(session: Session) -> Apartment:
    apartment = Apartment(
        building_name="Edifício Araraquara",
        zip_code="01000-000",
        manager_id="123",
        building_cnpj="12.345.678/0001-90",
    )
    session.add(apartment)
    session.commit()
    return apartment


@pytest.fixture
def buyer(session: Session, apartment: Apartment) -> Buyer:
    user = User(
        email="buyer@example.com",
        name="Ana",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    buyer = Buyer(
        user_id=user.id,
        apartment_id=apartment.id,
        unit="101",
    )
    session.add(buyer)
    session.commit()
    session.refresh(buyer)

    return buyer


@pytest.fixture
def purchase(session: Session, apartment: Apartment, farmer: Farmer) -> Purchase:
    purchase = Purchase(
        apartment=apartment, farmer=farmer, expected_delivery_date=FUTURE
    )
    session.add(purchase)
    session.commit()
    return purchase


# ==============================================================================
# Criação e valores padrão
# ==============================================================================


def test_review_generates_utc_timestamp_and_uuid_by_default():
    review = Review(rating=5, purchase_id=1, farmer_id=1, apartment_id=1)

    assert isinstance(review.public_id, UUID)
    assert isinstance(review.created_at, datetime)
    assert review.created_at.tzinfo == UTC
    assert review.updated_at is None
    assert review.comment == ""


def test_review_created_by_apartment_with_defaults(
    session: Session, apartment: Apartment, farmer: Farmer, purchase: Purchase
):
    review = Review(
        rating=5,
        apartment=apartment,
        farmer=farmer,
        purchase=purchase,
    )
    session.add(review)
    session.commit()

    assert review.id is not None
    assert isinstance(review.public_id, UUID)
    assert isinstance(review.created_at, datetime)
    assert review.updated_at is None
    assert review.comment == ""
    assert review.rating == 5
    assert review.apartment_id == apartment.id
    assert review.buyer_id is None
    assert review.farmer_id == farmer.id
    assert review.purchase_id == purchase.id


def test_review_created_by_buyer_with_comment(
    session: Session, buyer: Buyer, farmer: Farmer, purchase: Purchase
):
    review = Review(
        rating=4,
        comment="Entrega no prazo e laranjas bem frescas!",
        buyer=buyer,
        farmer=farmer,
        purchase=purchase,
    )
    session.add(review)
    session.commit()

    assert review.id is not None
    assert isinstance(review.public_id, UUID)
    assert review.rating == 4
    assert review.comment == "Entrega no prazo e laranjas bem frescas!"
    assert review.buyer_id == buyer.id
    assert review.apartment_id is None


# ==============================================================================
# Propriedades de conveniência (public_ids expostos)
# ==============================================================================


def test_review_apartment_public_id_properties(
    session: Session, apartment: Apartment, farmer: Farmer, purchase: Purchase
):
    review = Review(
        rating=5,
        apartment=apartment,
        farmer=farmer,
        purchase=purchase,
    )
    session.add(review)
    session.commit()

    assert review.apartment_public_id == apartment.public_id
    assert review.buyer_public_id is None
    assert review.farmer_public_id == farmer.public_id
    assert review.purchase_public_id == purchase.public_id


def test_review_buyer_public_id_properties(
    session: Session, buyer: Buyer, farmer: Farmer, purchase: Purchase
):
    review = Review(
        rating=4,
        buyer=buyer,
        farmer=farmer,
        purchase=purchase,
    )
    session.add(review)
    session.commit()

    assert review.buyer_public_id == buyer.public_id
    assert review.apartment_public_id is None
    assert review.farmer_public_id == farmer.public_id
    assert review.purchase_public_id == purchase.public_id


# ==============================================================================
# Validação de autoria exclusiva (ck_review_exactly_one_author)
# ==============================================================================


def test_review_rejects_missing_author(
    session: Session, farmer: Farmer, purchase: Purchase
):
    review = Review(
        rating=3,
        farmer_id=farmer.id,
        purchase_id=purchase.id,
        apartment_id=None,
        buyer_id=None,
    )
    session.add(review)

    with pytest.raises(IntegrityError):
        session.commit()


def test_review_rejects_both_authors(
    session: Session,
    apartment: Apartment,
    buyer: Buyer,
    farmer: Farmer,
    purchase: Purchase,
):
    review = Review(
        rating=3,
        apartment_id=apartment.id,
        buyer_id=buyer.id,
        farmer_id=farmer.id,
        purchase_id=purchase.id,
    )
    session.add(review)

    with pytest.raises(IntegrityError):
        session.commit()


# ==============================================================================
# Restrições de unicidade (uma avaliação por autor por compra/produtor)
# ==============================================================================


def test_apartment_cannot_review_same_purchase_twice(
    session: Session, apartment: Apartment, farmer: Farmer, purchase: Purchase
):
    review1 = Review(rating=5, apartment=apartment, farmer=farmer, purchase=purchase)
    review2 = Review(rating=4, apartment=apartment, farmer=farmer, purchase=purchase)
    session.add(review1)
    session.commit()

    session.add(review2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_buyer_cannot_review_same_purchase_twice(
    session: Session, buyer: Buyer, farmer: Farmer, purchase: Purchase
):
    review1 = Review(rating=5, buyer=buyer, farmer=farmer, purchase=purchase)
    review2 = Review(rating=3, buyer=buyer, farmer=farmer, purchase=purchase)
    session.add(review1)
    session.commit()

    session.add(review2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_apartment_can_review_different_purchases(
    session: Session, apartment: Apartment, farmer: Farmer, purchase: Purchase
):
    purchase2 = Purchase(
        apartment=apartment, farmer=farmer, expected_delivery_date=FUTURE
    )
    session.add(purchase2)
    session.commit()

    review1 = Review(rating=5, apartment=apartment, farmer=farmer, purchase=purchase)
    review2 = Review(rating=4, apartment=apartment, farmer=farmer, purchase=purchase2)
    session.add_all([review1, review2])
    session.commit()

    assert review1.id is not None
    assert review2.id is not None


def test_buyer_can_review_different_purchases(
    session: Session,
    apartment: Apartment,
    buyer: Buyer,
    farmer: Farmer,
    purchase: Purchase,
):
    purchase2 = Purchase(
        apartment=apartment, farmer=farmer, expected_delivery_date=FUTURE
    )
    session.add(purchase2)
    session.commit()

    review1 = Review(rating=4, buyer=buyer, farmer=farmer, purchase=purchase)
    review2 = Review(rating=5, buyer=buyer, farmer=farmer, purchase=purchase2)
    session.add_all([review1, review2])
    session.commit()

    assert review1.id is not None
    assert review2.id is not None


def test_different_buyers_can_review_same_purchase(
    session: Session,
    apartment: Apartment,
    buyer: Buyer,
    farmer: Farmer,
    purchase: Purchase,
):
    buyer2 = Buyer(
        email="carlos@example.com",
        name="Carlos",
        apartment_id=apartment.id,
        user_id=10,
        unit="arara",
    )
    session.add(buyer2)
    session.commit()

    review1 = Review(rating=4, buyer=buyer, farmer=farmer, purchase=purchase)
    review2 = Review(rating=5, buyer=buyer2, farmer=farmer, purchase=purchase)
    session.add_all([review1, review2])
    session.commit()

    assert review1.id is not None
    assert review2.id is not None


def test_apartment_and_buyer_can_both_review_same_purchase(
    session: Session,
    apartment: Apartment,
    buyer: Buyer,
    farmer: Farmer,
    purchase: Purchase,
):
    review_apt = Review(rating=5, apartment=apartment, farmer=farmer, purchase=purchase)
    review_buyer = Review(rating=4, buyer=buyer, farmer=farmer, purchase=purchase)
    session.add_all([review_apt, review_buyer])
    session.commit()

    assert review_apt.id is not None
    assert review_buyer.id is not None


# ==============================================================================
# Validações de campos (Pydantic / SQLModel)
# ==============================================================================


@pytest.mark.parametrize("valid_rating", [1, 2, 3, 4, 5])
def test_review_accepts_valid_ratings(valid_rating: int):
    review = Review(rating=valid_rating, purchase_id=1, farmer_id=1, apartment_id=1)
    assert review.rating == valid_rating


@pytest.mark.parametrize("invalid_rating", [-1, 0, 6, 10])
def test_review_rejects_rating_out_of_bounds(invalid_rating: int):
    with pytest.raises(ValidationError) as exc_info:
        Review.model_validate(
            {
                "rating": invalid_rating,
                "purchase_id": 1,
                "farmer_id": 1,
                "apartment_id": 1,
            }
        )

    assert exc_info.value.errors()[0]["loc"] == ("rating",)


def test_review_accepts_comment_up_to_max_length():
    max_comment = "a" * 500
    review = Review(
        rating=5, comment=max_comment, purchase_id=1, farmer_id=1, apartment_id=1
    )
    assert review.comment == max_comment


def test_review_rejects_comment_exceeding_max_length():
    too_long_comment = "a" * 501
    with pytest.raises(ValidationError) as exc_info:
        Review.model_validate(
            {
                "rating": 5,
                "comment": too_long_comment,
                "purchase_id": 1,
                "farmer_id": 1,
                "apartment_id": 1,
            }
        )

    assert exc_info.value.errors()[0]["loc"] == ("comment",)


# ==============================================================================
# Atualização de avaliação
# ==============================================================================


def test_review_can_be_updated(
    session: Session, apartment: Apartment, farmer: Farmer, purchase: Purchase
):
    review = Review(
        rating=3,
        comment="Bom, mas faltou cuidado na embalagem.",
        apartment=apartment,
        farmer=farmer,
        purchase=purchase,
    )
    session.add(review)
    session.commit()
    assert review.updated_at is None

    review.rating = 4
    review.comment = "O produtor reenviou os itens com embalagem reforçada!"
    session.add(review)
    session.commit()

    session.refresh(review)
    assert review.rating == 4
    assert review.comment == "O produtor reenviou os itens com embalagem reforçada!"
    assert review.updated_at is not None


# ==============================================================================
# Schemas de criação, edição e leitura
# ==============================================================================


def test_review_create_works_for_valid_data():
    review = ReviewCreate(rating=5, comment="Ótimas verduras")

    assert Counter(review.__dict__.keys()) == Counter(["rating", "comment"])
    assert review.rating == 5
    assert review.comment == "Ótimas verduras"


@pytest.mark.parametrize(
    "field, value",
    [
        ("rating", 0),
        ("rating", 6),
        ("rating", None),
        ("comment", "a" * 501),
        ("comment", None),
    ],
)
def test_review_create_rejects_invalid_field(field: str, value: object):
    with pytest.raises(ValidationError) as exc_info:
        ReviewCreate(**{"rating": 5, field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


def test_review_read_from_table_doesnt_expose_sensitive_information(
    session: Session, buyer: Buyer, farmer: Farmer, purchase: Purchase
):
    review = Review(rating=4, buyer=buyer, farmer=farmer, purchase=purchase)
    session.add(review)
    session.commit()

    review_read = ReviewRead.model_validate(review)

    assert review_read.public_id == review.public_id
    assert review_read.purchase_public_id == purchase.public_id
    assert review_read.farmer_public_id == farmer.public_id
    assert review_read.buyer_public_id == buyer.public_id
    assert review_read.apartment_public_id is None
    assert "id" not in review_read.model_dump()
    assert "buyer_id" not in review_read.model_dump()


def test_review_read_hides_internal_id():
    review_read = ReviewRead(
        rating=5,
        public_id=uuid4(),
        purchase_public_id=uuid4(),
        farmer_public_id=uuid4(),
        apartment_public_id=uuid4(),
        buyer_public_id=None,
        created_at=datetime.now(UTC),
        updated_at=None,
        id=1,
    )

    assert "id" not in review_read.model_dump()


@pytest.mark.parametrize(
    "field, value",
    [
        ("rating", 0),
        ("rating", 6),
        ("rating", None),
        ("comment", "a" * 501),
        ("comment", None),
    ],
)
def test_review_update_rejects_invalid_field(field: str, value: object):
    with pytest.raises(ValidationError) as exc_info:
        ReviewUpdate(**{field: value})

    assert exc_info.value.errors()[0]["loc"] == (field,)


def test_review_update_ignores_unknown_fields():
    review_update = ReviewUpdate(rating=4, farmer_id=1, created_at=datetime.now(UTC))

    assert review_update.model_dump(exclude_unset=True) == {"rating": 4}
