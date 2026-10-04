from uuid import uuid4

from src.models.apartment import Apartment
from src.models.buyer import Buyer


def test_buyer_creation():
    buyer = Buyer(
        public_id=uuid4(),
        email="buyer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
    )

    assert buyer.name == "João"
    assert buyer.email == "buyer@example.com"
    assert buyer.picture_url == "https://example.com/photo.jpg"
    assert buyer.apartment_id is None


def test_buyer_can_belong_to_apartment():
    apartment = Apartment(
        public_id=uuid4(),
        email="apartment@example.com",
        name="Edifício Araraquara",
        picture_url="https://example.com/apartment.jpg",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    buyer = Buyer(
        public_id=uuid4(),
        email="buyer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        apartment=apartment,
    )

    assert buyer.apartment == apartment
