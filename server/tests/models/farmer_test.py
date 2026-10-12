from uuid import uuid4

from src.models.farmer import Farmer


def test_farmer_creation():
    farmer = Farmer(
        public_id=uuid4(),
        email="farmer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        zip_code="01000-000",
    )

    assert farmer.name == "João"
    assert farmer.email == "farmer@example.com"
    assert farmer.picture_url == "https://example.com/photo.jpg"
    assert farmer.zip_code == "01000-000"


def test_farmer_public_id_is_uuid():
    public_id = uuid4()

    farmer = Farmer(
        public_id=public_id,
        email="farmer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        zip_code="01000-000",
    )

    assert farmer.public_id == public_id


def test_farmer_inherits_user_base_fields():
    farmer = Farmer(
        public_id=uuid4(),
        email="farmer@example.com",
        name="João",
        picture_url=None,
        zip_code="01000-000",
    )

    assert farmer.email == "farmer@example.com"
    assert farmer.name == "João"
    assert farmer.picture_url is None
