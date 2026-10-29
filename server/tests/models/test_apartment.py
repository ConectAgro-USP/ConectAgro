from datetime import UTC, datetime
from uuid import UUID

import pytest
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.user import User


@pytest.fixture
def buyer(session: Session) -> Buyer:
    user = User(email="buyer@example.com", name="João", picture_url="https://example.com/photo.jpg")
    session.add(user)
    session.commit()
    session.refresh(user)

    buyer = Buyer(user_id= user.id, unit = "404")
    session.add(buyer)
    session.commit()
    session.refresh(buyer)
    return buyer

@pytest.fixture
def apartment(session: Session) -> Apartment:
    user = User(email="manager@example.com", name="Matheus",
                        picture_url="https://example.com/photo.jpg", 
                        cellphone = "11944644502", homephone = "1124644502")
    session.add(user)
    session.commit()
    session.refresh(user)
    apartment = Apartment(manager_id = user.id, zip_code = "01000-000",
                          building_name="Edifício Araraquara",
                          building_cnpj = "12.345.678/0001-90")
    session.add(apartment)
    session.commit()
    session.refresh(apartment)
    return apartment



def test_apartment_creation(apartment : Apartment):
    assert apartment.manager.name == "Matheus"
    assert apartment.manager.email == "manager@example.com"
    assert apartment.manager.picture_url == "https://example.com/photo.jpg"
    assert apartment.manager.cellphone == "11944644502"
    assert apartment.manager.homephone == "1124644502"
    assert apartment.zip_code == "01000-000"
    assert apartment.manager_id == apartment.manager.id 
    assert apartment.building_name == "Edifício Araraquara"
    assert apartment.building_cnpj == "12.345.678/0001-90"


def test_change_manager(apartment : Apartment):
    apartment.change_manager(456)
    assert apartment.manager_id == 456


def test_apartment_update_buyer_link_status(apartment : Apartment, buyer : Buyer):
    now = datetime.now(UTC)
    buyer.apartment = apartment
    buyer.link_status = LinkStatus.APROVADO
    buyer.link_reviewed_at = now

    assert buyer.apartment == apartment
    assert buyer.link_status == LinkStatus.APROVADO
    assert buyer.link_reviewed_at == now
    assert buyer in apartment.buyers


def test_apartment_generates_public_id(apartment : Apartment):
    assert isinstance(apartment.public_id, UUID)