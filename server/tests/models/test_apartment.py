from uuid import UUID, uuid4

import pytest

from src.models.apartment import Apartment


def test_apartment_creation():
    apartment = Apartment(
        public_id=uuid4(),
        email="apartment@example.com",
        name="Edifício Araraquara",
        picture_url="https://example.com/photo.jpg",
        phone="(11) 94464-4502",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    assert apartment.name == "Edifício Araraquara"
    assert apartment.email == "apartment@example.com"
    assert apartment.picture_url == "https://example.com/photo.jpg"
    assert apartment.phone == "11944644502"
    assert apartment.zip_code == "01000-000"
    assert apartment.building_manager_id == "123"
    assert apartment.building_tax_id == "12.345.678/0001-90"


def test_apartment_inherits_user_base_fields():
    apartment = Apartment(
        public_id=uuid4(),
        email="apartment@example.com",
        name="Edifício Araraquara",
        picture_url=None,
        phone="(11) 94464-4502",
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
        phone="(11) 94464-4502",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    apartment.change_manager("456")

    assert apartment.building_manager_id == "456"


def test_apartment_generates_public_id():
    apartment = Apartment(
        email="apartment@example.com",
        name="Edifício Araraquara",
        phone="(11) 94464-4502",
        zip_code="01000-000",
        building_manager_id="123",
        building_tax_id="12.345.678/0001-90",
    )

    assert isinstance(apartment.public_id, UUID)


def test_apartment_invalid_phone():
    with pytest.raises(ValueError) as exc_info:
        Apartment(
            public_id=uuid4(),
            email="apartment@example.com",
            name="Edifício Araraquara",
            picture_url=None,
            phone="(11) 944-402",
            zip_code="01000-000",
            building_manager_id="123",
            building_tax_id="12.345.678/0001-90",
        )

    assert "Não é um número válido" in str(exc_info.value)


def test_apartment_invalid_ddd():
    with pytest.raises(ValueError) as exc_info:
        Apartment(
            public_id=uuid4(),
            email="apartment@example.com",
            name="Edifício Araraquara",
            picture_url=None,
            phone="(25) 94002 8922",
            zip_code="01000-000",
            building_manager_id="123",
            building_tax_id="12.345.678/0001-90",
        )

    assert "O DDD do número é inválido" in str(exc_info.value)
