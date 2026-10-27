from uuid import UUID, uuid4

import pytest
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.user import User


@pytest.fixture
def buyer(session: Session) -> Buyer:
    user = User(email="buyer@example.com", name="João", picture_url="https://example.com/photo.jpg")
    session.add(user)
    session.commit()
    session.refresh(user)

    buyer = Buyer(user_id= user.id)
    session.add(buyer)
    session.commit()
    session.refresh(buyer)
    return buyer


def test_buyer_creation(buyer : Buyer):
    assert buyer.user.name == "João"
    assert buyer.user.email == "buyer@example.com"
    assert buyer.user.picture_url == "https://example.com/photo.jpg"
    assert buyer is buyer
    assert buyer.apartment_id is None


def test_buyer_can_belong_to_apartment(buyer : Buyer):
    apartment = Apartment(
        public_id=uuid4(),
        user_id=10,
        # email="apartment@example.com",
        # name="Edifício Araraquara",
        # picture_url="https://example.com/apartment.jpg",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    buyer.apartment = apartment

    assert buyer.apartment == apartment


def test_buyer_generates_public_id(buyer : Buyer):
    # buyer = Buyer(email="buyer@example.com", name="João")

    assert isinstance(buyer.public_id, UUID)
