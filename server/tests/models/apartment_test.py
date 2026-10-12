from uuid import uuid4

from src.models.apartment import Apartment


def test_apartment_creation():
    apartment = Apartment(
        public_id=uuid4(),
        email="apartment@example.com",
        name="Edifício Araraquara",
        picture_url="https://example.com/photo.jpg",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    assert apartment.name == "Edifício Araraquara"
    assert apartment.email == "apartment@example.com"
    assert apartment.picture_url == "https://example.com/photo.jpg"
    assert apartment.zip_code == "01000-000"
    assert apartment.building_manager_id == "123"
    assert apartment.building_tax_id == "12.345.678/0001-90"


def test_apartment_inherits_user_base_fields():
    apartment = Apartment(
        public_id=uuid4(),
        email="apartment@example.com",
        name="Edifício Araraquara",
        picture_url=None,
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    assert apartment.email == "apartment@example.com"
    assert apartment.name == "Edifício Araraquara"
    assert apartment.picture_url is None


def test_change_manager():
    apartment = Apartment(
        public_id=uuid4(),
        email="apartment@example.com",
        name="Edifício Araraquara",
        picture_url=None,
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    apartment.change_manager("456")

    assert apartment.building_manager_id == "456"
