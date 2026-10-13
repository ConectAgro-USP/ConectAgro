from uuid import UUID, uuid4

import pytest

from src.models.farmer import Farmer


def test_farmer_creation():
    farmer = Farmer(
        public_id=uuid4(),
        email="farmer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        cellphone="(11) 95724-9062",
        homephone="11 4002-8922",
        zip_code="01000-000",
    )

    assert farmer.name == "João"
    assert farmer.email == "farmer@example.com"
    assert farmer.picture_url == "https://example.com/photo.jpg"
    assert farmer.cellphone == "11957249062"
    assert farmer.homephone == "1140028922"
    assert farmer.zip_code == "01000-000"


def test_farmer_public_id_is_uuid():
    public_id = uuid4()

    farmer = Farmer(
        public_id=public_id,
        email="farmer@example.com",
        name="João",
        picture_url="https://example.com/photo.jpg",
        cellphone="(11) 95724-9062",
        zip_code="01000-000",
    )

    assert farmer.public_id == public_id


def test_farmer_generates_public_id():
    farmer = Farmer(
        email="farmer@example.com", name="João", cellphone="(11) 95724-9062", zip_code="01000-000"
    )

    assert isinstance(farmer.public_id, UUID)


def test_farmer_inherits_user_base_fields():
    farmer = Farmer(
        public_id=uuid4(),
        email="farmer@example.com",
        name="João",
        picture_url=None,
        cellphone="(11) 95724-9062",
        zip_code="01000-000",
    )

    assert farmer.email == "farmer@example.com"
    assert farmer.name == "João"
    assert farmer.picture_url is None


def test_farmer_invalid_cellphone():
    with pytest.raises(ValueError) as exc_info:
        Farmer(
            public_id=uuid4(),
            email="farmer@example.com",
            name="João",
            cellphone="(11) 950-653",
            zip_code="01000-000",
        )
        
    assert "Não é um número de telefone celular válido" in str(exc_info.value)


def test_farmer_invalid_homephone():
    with pytest.raises(ValueError) as exc_info:
        Farmer(
            public_id=uuid4(),
            email="farmer@example.com",
            name="João",
            cellphone="(11) 95724-9062",
            homephone="(11) 94002-8922",
            zip_code="01000-000",
        )
        
    assert "Não é um número de telefone fixo válido" in str(exc_info.value)


def test_farmer_invalid_ddd():
    with pytest.raises(ValueError) as exc_info:
        Farmer(
            public_id=uuid4(),
            email="farmer@example.com",
            name="João",
            cellphone="(25) 94002 8922",
            zip_code="01000-000",
        )
        
    assert "O DDD 25 é inválido" in str(exc_info.value)
