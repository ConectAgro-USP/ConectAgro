from uuid import UUID

import pytest
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.user import User


@pytest.fixture
def apartment(session: Session) -> Apartment:
    user = User(email="apartment@example.com", name="Edifício Araraquara",
                picture_url="https://example.com/photo.jpg", 
                cellphone = "11944644502", homephone = "1124644502")
    session.add(user)
    session.commit()
    session.refresh(user)

    apartment = Apartment(user_id = user.id, zip_code = "01000-000",
                          building_manager_id = "123", building_tax_id = "12.345.678/0001-90")
    session.add(apartment)
    session.commit()
    session.refresh(apartment)
    return apartment



def test_apartment_creation(apartment : Apartment):
    assert apartment.user.name == "Edifício Araraquara"
    assert apartment.user.email == "apartment@example.com"
    assert apartment.user.picture_url == "https://example.com/photo.jpg"
    assert apartment.user.cellphone == "11944644502"
    assert apartment.user.homephone == "1124644502"
    assert apartment.zip_code == "01000-000"
    assert apartment.building_manager_id == "123"
    assert apartment.building_tax_id == "12.345.678/0001-90"


def test_apartment_inherits_user_base_fields(apartment : Apartment):
    apartment.user.picture_url = None

    assert apartment.user.email == "apartment@example.com"
    assert apartment.user.name == "Edifício Araraquara"
    assert apartment.user.picture_url is None


def test_change_manager(apartment : Apartment):
    apartment.change_manager("456")
    assert apartment.building_manager_id == "456"


def test_apartment_generates_public_id(apartment : Apartment):
    assert isinstance(apartment.public_id, UUID)
