from uuid import UUID, uuid4

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


def test_farmer_generates_public_id():
    farmer = Farmer(email="farmer@example.com", name="João", zip_code="01000-000")

    assert isinstance(farmer.public_id, UUID)
