import os
from collections.abc import Generator

os.environ.update(
    APP_FLAVOR="dev",
    DATABASE_URL="sqlite://",
    SESSION_SECRET_KEY="test-session-secret-with-32-chars!",
    JWT_SECRET_KEY="test-jwt-secret-with-at-least-32-chars",
    ACCESS_TOKEN_EXPIRE_MINUTES="60",
    FRONTEND_URL="http://localhost:5173",
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from src.api import rate_limits
from src.api.deps import RECENT_ADDRESSES, RECENT_COMPANIES, get_session
from src.main import app
from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.purchase import Purchase, PurchaseStatus
from src.models.user import User
from tests.helpers import (
    ITAU_CNPJ,
    add_building,
    add_farmer,
    add_purchase_from,
    add_resident,
    add_user,
    login,
)

engine_test = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


def override_get_session():
    with Session(engine_test) as session:
        yield session


@pytest.fixture(autouse=True)
def setup_database():
    SQLModel.metadata.create_all(engine_test)
    app.dependency_overrides[get_session] = override_get_session
    yield
    app.dependency_overrides.clear()
    SQLModel.metadata.drop_all(engine_test)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    for limiter in rate_limits.ALL_LIMITERS:
        limiter.reset()


@pytest.fixture(autouse=True)
def reset_recent_lookups():
    RECENT_COMPANIES.reset()
    RECENT_ADDRESSES.reset()


@pytest.fixture
def session() -> Generator[Session, None, None]:
    with Session(engine_test) as session:
        yield session


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def ana(client: TestClient, session: Session) -> User:
    user = add_user(session, "ana@example.com")
    login(client, user)
    return user


@pytest.fixture
def manager(session: Session) -> User:
    return add_user(session, "sindico@example.com")


@pytest.fixture
def building(session: Session, manager: User) -> Apartment:
    return add_building(session, manager)


@pytest.fixture
def other_building(session: Session) -> Apartment:
    other_manager = add_user(session, "outro@example.com")
    return add_building(session, other_manager, name="Edifício Bauru", cnpj=ITAU_CNPJ)


@pytest.fixture
def farmer(client: TestClient, session: Session) -> Farmer:
    user = add_user(session, "joao@example.com", name="João Silva")
    farmer = add_farmer(session, user)
    login(client, user)
    return farmer


@pytest.fixture
def seller(session: Session) -> Farmer:
    # agricultor sem login: o produto é visto por quem não é o dono
    return add_farmer(session, add_user(session, "sitio@example.com", name="João Silva"))


@pytest.fixture
def joao(session: Session) -> Farmer:
    return add_farmer(session, add_user(session, "joao@example.com", name="João Lima"))


@pytest.fixture
def maria(session: Session) -> Farmer:
    return add_farmer(session, add_user(session, "maria@example.com"))


@pytest.fixture
def purchase(session: Session, building: Apartment, joao: Farmer, maria: Farmer) -> Purchase:
    delivered, in_progress = PurchaseStatus.ENTREGUE, PurchaseStatus.EM_PROGRESSO
    return add_purchase_from(session, building.id, (joao, delivered), (maria, in_progress))


@pytest.fixture
def resident(session: Session, building: Apartment) -> Buyer:
    user = add_user(session, "morador@example.com")
    return add_resident(session, building, user, link_status=LinkStatus.APROVADO)
