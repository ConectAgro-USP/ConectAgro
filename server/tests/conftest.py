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

from src.api.deps import get_session
from src.main import app

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


@pytest.fixture()
def session() -> Generator[Session, None, None]:
    with Session(engine_test) as session:
        yield session


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client
