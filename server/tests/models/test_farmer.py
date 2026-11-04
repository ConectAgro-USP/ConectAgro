from uuid import UUID, uuid4

import pytest
from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.user import User


@pytest.fixture
def farmer(session: Session) -> Farmer:
    user = User(email="farmer@example.com", name="João",
                picture_url="https://example.com/photo.jpg",
                cellphone = "11957249062", homephone="1140028922")
    session.add(user)
    session.commit()
    session.refresh(user)

    farmer = Farmer(user_id = user.id, zip_code = "01000-000")
    session.add(farmer)
    session.commit()
    session.refresh(farmer)
    return farmer


def test_farmer_creation(farmer: Farmer):
    assert farmer.user.name == "João"
    assert farmer.user.email == "farmer@example.com"
    assert farmer.user.picture_url == "https://example.com/photo.jpg"
    assert farmer.user.cellphone == "11957249062"
    assert farmer.user.homephone == "1140028922"
    assert farmer.zip_code == "01000-000"


def test_farmer_public_id_is_uuid(farmer: Farmer):
    public_id = uuid4()

    farmer.public_id = public_id

    assert farmer.public_id == public_id


def test_farmer_generates_public_id(farmer: Farmer):
    assert isinstance(farmer.public_id, UUID)


def test_farmer_inherits_user_base_fields(farmer: Farmer):
    farmer.user.picture_url = None

    assert farmer.user.email == "farmer@example.com"
    assert farmer.user.name == "João"
    assert farmer.user.picture_url is None
