from uuid import UUID, uuid4

import pytest

from src.models.farmer import Farmer


@pytest.fixture
def farmer_data():
    return Farmer.model_validate(
        {
            "public_id": uuid4(),
            "email": "farmer@example.com",
            "name": "João",
            "picture_url": "https://example.com/photo.jpg",
            "cellphone": "(11) 95724-9062",
            "homephone": "(11) 4002-8922",
            "zip_code": "01000-000",
        }
    )


def test_farmer_creation(farmer_data):
    farmer = farmer_data

    assert farmer.name == "João"
    assert farmer.email == "farmer@example.com"
    assert farmer.picture_url == "https://example.com/photo.jpg"
    assert farmer.cellphone == "11957249062"
    assert farmer.homephone == "1140028922"
    assert farmer.zip_code == "01000-000"


def test_farmer_public_id_is_uuid(farmer_data):
    farmer = farmer_data
    public_id = uuid4()

    farmer.public_id = public_id

    assert farmer.public_id == public_id


def test_farmer_generates_public_id():
    farmer = Farmer(
        email="farmer@example.com", name="João", cellphone="(11) 95724-9062", zip_code="01000-000"
    )

    assert isinstance(farmer.public_id, UUID)


def test_farmer_inherits_user_base_fields(farmer_data):
    farmer = farmer_data
    farmer.picture_url = None

    assert farmer.email == "farmer@example.com"
    assert farmer.name == "João"
    assert farmer.picture_url is None
