from datetime import datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from src.core.security import create_access_token
from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from src.models.user import User

# CNPJs reais com dígitos verificadores válidos
BANCO_DO_BRASIL_CNPJ = "00000000000191"
ITAU_CNPJ = "60701190000104"


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def read(self) -> float:
        return self.now


def add_user(
    session: Session, email: str, name: str = "Ana Souza", cpf: str | None = None
) -> User:
    user = User(email=email, name=name, cpf=cpf)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def login(client: TestClient, user: User) -> None:
    client.cookies.set("access_token", create_access_token(user.id, user.session_version))


def add_farmer(session: Session, user: User) -> Farmer:
    farmer = Farmer(user_id=user.id, zip_code="01310200")
    session.add(farmer)
    session.commit()
    session.refresh(farmer)
    return farmer


def add_product(session: Session, farmer: Farmer, name: str = "Alface", **overrides) -> Product:
    # permite adicionar produtos inválidos (expirados, por exemplo) para testes,
    # pois os dados não passam por ProductCreate
    data = {
        "name": name,
        "quantity": 10,
        "price": Decimal("2.50"),
        "expiration_date": datetime.now(BUSINESS_TZ).date() + timedelta(days=30),
        "farmer_id": farmer.id,
    }
    product = Product(**{**data, **overrides})
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def add_building(
    session: Session,
    manager: User,
    name: str = "Edifício Araraquara",
    cnpj: str = BANCO_DO_BRASIL_CNPJ,
) -> Apartment:
    building = Apartment(
        manager_id=manager.id,
        building_name=name,
        zip_code="01310200",
        building_cnpj=cnpj,
    )
    session.add(building)
    session.commit()
    session.refresh(building)
    return building


def add_resident(
    session: Session,
    building: Apartment,
    user: User,
    unit: str = "42",
    link_status: LinkStatus = LinkStatus.PENDENTE,
) -> Buyer:
    resident = Buyer(
        user_id=user.id,
        apartment_id=building.id,
        unit=unit,
        link_status=link_status,
    )
    session.add(resident)
    session.commit()
    session.refresh(resident)
    return resident
