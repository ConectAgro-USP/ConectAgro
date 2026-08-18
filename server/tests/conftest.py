import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SESSION_SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)
