import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SESSION_SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

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
def client() -> TestClient:
    return TestClient(app)