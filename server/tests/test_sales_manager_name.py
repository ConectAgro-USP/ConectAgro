import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.user import User
from tests.helpers import add_product, add_purchase
from tests.sales import sales_of


@pytest.fixture
def lettuce(session: Session, joao: Farmer) -> Product:
    return add_product(session, joao, name="Alface")


@pytest.mark.parametrize(
    "stored_name, shown_name",
    [
        ("sindico@gmail.com", ""),
        ("Carla Mendes da Silva", "Carla Mendes da Silva"),
        ("Carla", "Carla"),
    ],
    ids=["e-mail", "nome-completo", "um-nome"],
)
def test_sale_never_shows_the_manager_email_as_the_name(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
    joao: Farmer,
    lettuce: Product,
    stored_name: str,
    shown_name: str,
):
    manager.name = stored_name
    session.commit()
    add_purchase(session, building, (lettuce, 2))

    [sale] = sales_of(client, joao)

    assert sale["manager_name"] == shown_name
