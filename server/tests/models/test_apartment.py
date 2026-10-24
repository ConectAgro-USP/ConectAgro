from uuid import UUID, uuid4

import pytest

from src.models.apartment import Apartment


@pytest.fixture
def apartment_data():
    return Apartment.model_validate(
        {
            "public_id": uuid4(),
            "email": "apartment@example.com",
            "name": "Edifício Araraquara",
            "picture_url": "https://example.com/photo.jpg",
            "cellphone": "(11) 94464-4502",
            "homephone": "(11) 2464-4502",
            "zip_code": "01000-000",
            "building_manager_id": "123",
            "building_tax_id": "12.345.678/0001-90",
        }
    )


def test_apartment_creation(apartment_data):
    apartment = apartment_data
    assert apartment.name == "Edifício Araraquara"
    assert apartment.email == "apartment@example.com"
    assert apartment.picture_url == "https://example.com/photo.jpg"
    assert apartment.cellphone == "11944644502"
    assert apartment.homephone == "1124644502"
    assert apartment.zip_code == "01000-000"
    assert apartment.building_manager_id == "123"
    assert apartment.building_tax_id == "12.345.678/0001-90"


def test_apartment_inherits_user_base_fields(apartment_data):
    apartment = apartment_data
    apartment.picture_url = None

    assert apartment.email == "apartment@example.com"
    assert apartment.name == "Edifício Araraquara"
    assert apartment.picture_url is None


def test_change_manager(apartment_data):
    apartment = apartment_data

    apartment.change_manager("456")
    assert apartment.building_manager_id == "456"


def test_apartment_generates_public_id():
    apartment = Apartment(
        email="apartment@example.com",
        name="Edifício Araraquara",
        cellphone="(11) 94464-4502",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    assert isinstance(apartment.public_id, UUID)
