from uuid import uuid4

import pytest

from src.models.farmer import Farmer


def test_farmer_creation():
    farmer = Farmer(
        public_id=uuid4(),
        email="farmer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        phone="(11) 95724-9062",
        zip_code="01000-000",
    )

    assert farmer.name == "João"
    assert farmer.email == "farmer@example.com"
    assert farmer.picture_url == "https://example.com/photo.jpg"
    assert farmer.phone == "11957249062"
    assert farmer.zip_code == "01000-000"


def test_farmer_public_id_is_uuid():
    public_id = uuid4()

    farmer = Farmer(
        public_id=public_id,
        email="farmer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        phone="(11) 95724-9062",
        zip_code="01000-000",
    )

    assert farmer.public_id == public_id


def test_farmer_inherits_user_base_fields():
    farmer = Farmer(
        public_id=uuid4(),
        email="farmer@example.com",
        name="João",
        picture_url=None,
        phone="(11) 95724-9062",
        zip_code="01000-000",
    )

    assert farmer.email == "farmer@example.com"
    assert farmer.name == "João"
    assert farmer.picture_url is None


def test_farmer_invalid_phone():
    with pytest.raises(ValueError) as exc_info:
        Farmer(
            public_id=uuid4(),
            email="farmer@example.com",
            name="João",
            phone="(11) 950-653",
            zip_code="01000-000",
        )
        
    assert "Não é um número válido" in str(exc_info.value)


def test_farmer_invalid_ddd():
    with pytest.raises(ValueError) as exc_info:
        Farmer(
            public_id=uuid4(),
            email="farmer@example.com",
            name="João",
            phone="(25) 94002 8922",
            zip_code="01000-000",
        )
        
    assert "O DDD do número é inválido" in str(exc_info.value)