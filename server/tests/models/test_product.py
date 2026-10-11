from uuid import uuid4
from decimal import Decimal
from datetime import UTC, date, datetime
from pytest import raises

from pydantic_core._pydantic_core import *

from src.models.product import Product, ProductCreate, ProductUpdate, ProductRead
from src.models.farmer import Farmer

def test_product_creation():
    product = Product(
        name="Sonic",
        description="Bicho azul",
        picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
        quantity=1,
        price=2.03,
        expiration_date="2030-01-30",
    )

    assert product.name == "Sonic"
    assert product.description == "Bicho azul"
    assert product.picture_url =="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png"
    assert product.quantity == 1
    assert product.price == 2.03
    assert product.expiration_date == "2030-01-30" 
    assert type(product.public_id) == type(uuid4())
    assert type(product.created_at) == type(datetime.now(UTC))


def test_product_create():
    product = ProductCreate(
        name="Sonic",
        description="Bicho azul",
        picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
        quantity=1,
        price=2.03,
        expiration_date="2030-01-30",
        farmer_public_id=uuid4()
    )

    assert product.name == "Sonic"
    assert product.description == "Bicho azul"
    assert product.picture_url =="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png"
    assert product.quantity == 1
    assert product.price == Decimal('2.03')
    assert product.expiration_date == date(2030, 1, 30)
    assert type(product.farmer_public_id) == type(uuid4())

    # nome como string vazia
    with raises(ValidationError):
        product = ProductCreate(
            name="",
            description="Bicho azul",
            picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
            quantity=1,
            price=2.03,
            expiration_date="2030-01-30",
            farmer_public_id=uuid4()
        )

    # tipo errado (description)
    with raises(ValidationError):
        product = ProductCreate(
            name="S",
            description=1,
            picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
            quantity=1,
            price=2.03,
            expiration_date="2030-01-30",
            farmer_public_id=uuid4()
        )


def test_product_create_with_expired_product():
    with raises(ValidationError) as error_msg:
        product = ProductCreate(
            name="S",
            description=None,
            picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
            quantity=1,
            price=2.03,
            expiration_date="2000-01-30",
            farmer_public_id=uuid4()
        )

    assert "Não é possível cadastrar produto vencido" in str(error_msg.value)


def test_product_create_with_invalid_quantity():
    with raises(ValidationError):
        product = ProductCreate(
            name="S",
            description=None,
            picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
            quantity=-1,
            price=2.03,
            expiration_date="2030-01-30",
            farmer_public_id=uuid4()
        )


def test_product_create_with_invalid_price():
    with raises(ValidationError):
        product = ProductCreate(
            name="S",
            description=None,
            picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
            quantity=1,
            price=-2.03,
            expiration_date="2030-01-30",
            farmer_public_id=uuid4()
        )


def test_product_read():
    product_read = ProductRead(
        name="Sonic",
        description="Bicho azul",
        picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
        quantity=1,
        price=Decimal('2.03'),
        expiration_date=date(2030, 1, 30),
        public_id=uuid4(),
        created_at=datetime.now(UTC),
        farmer_public_id=uuid4(),
        id=1
    )

    assert product_read.name == "Sonic"
    assert type(product_read.farmer_public_id) == type(uuid4()) 
    
    # checa se o ProductRead não devolve informações que não deveria
    with raises(AttributeError):
        product_read.id

    # checa criação de ProductRead com tipos errados (nome)
    with raises(ValidationError):
        product_read = ProductRead(
            name=1,
            description="Bicho azul",
            picture_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/f4/Sonic_modern_and_classic_designs.png/250px-Sonic_modern_and_classic_designs.png",
            quantity=1,
            price=Decimal('2.03'),
            expiration_date=date(2030, 1, 30),
            public_id=uuid4(),
            created_at=datetime.now(UTC),
            farmer_public_id=uuid4(),
            id=1
        )

def test_product_update():
    # checa tentativa de atualizar campos de maneira indevida
    with raises(ValidationError) as error_msg:
        product_update = ProductUpdate(
            name=None,
            description=None,
            picture_url=None,
            quantity=None,
            price=-1,
            expiration_date=None,
            public_id=None
        )

    with raises(ValidationError) as error_msg:
        product_update = ProductUpdate(
            name=None,
            description=None,
            picture_url=None,
            quantity=-1,
            price=1,
            expiration_date=None,
            public_id=None
        )
    
    # checa tentativa de alterar campos indevidos do produto (created_at)
    product_update = ProductUpdate(
        name=None,
        description=None,
        picture_url=None,
        quantity=None,
        price=None,
        expiration_date=date(2030,2,1),
        created_at=datetime.now(UTC)
    )

    with raises(AttributeError):
        product_update.created_at

    # checa update com produto fora da validade
    with raises(ValidationError) as error_msg:
        product_update = ProductUpdate(
            name=None,
            description=None,
            picture_url=None,
            quantity=None,
            price=None,
            expiration_date=date(2000, 1, 30),
            public_id=None
        )

    assert "Atualização faz com que o produto esteja fora da validade" in str(error_msg.value)