from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, create_engine

from alembic import command
from src.core.config import settings
from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ
from tests.helpers import add_product
from tests.test_migrations import alembic_config

UNITS = ["kg", "unidade", "duzia", "maco", "litro"]


def product_payload(**overrides) -> dict:
    expiration = datetime.now(BUSINESS_TZ).date() + timedelta(days=10)
    payload = {
        "name": "Ovos caipiras",
        "quantity": 5,
        "price": "9.00",
        "expiration_date": expiration.isoformat(),
    }
    return {**payload, **overrides}


def test_product_created_without_unit_is_sold_by_kilo(client: TestClient, farmer: Farmer):
    response = client.post("/api/products", json=product_payload())

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["unit"] == "kg"


@pytest.mark.parametrize("unit", UNITS)
def test_every_unit_is_accepted_and_shown_everywhere(client: TestClient, farmer: Farmer, unit: str):
    created = client.post("/api/products", json=product_payload(unit=unit)).json()
    public_id = created["public_id"]

    detail = client.get(f"/api/products/{public_id}").json()
    catalog = client.get("/api/products").json()["items"]
    mine = client.get("/api/products/me").json()["items"]

    assert created["unit"] == unit
    assert detail["unit"] == unit
    assert [item["unit"] for item in catalog] == [unit]
    assert [item["unit"] for item in mine] == [unit]


@pytest.mark.parametrize("unit", ["quilo", "KG", "", "g"])
def test_unknown_unit_is_refused(client: TestClient, farmer: Farmer, unit: str):
    response = client.post("/api/products", json=product_payload(unit=unit))

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["body", "unit"]


def test_owner_changes_only_the_unit(client: TestClient, session: Session, farmer: Farmer):
    eggs = add_product(session, farmer, name="Ovos")

    response = client.patch(f"/api/products/{eggs.public_id}", json={"unit": "duzia"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["unit"] == "duzia"
    assert response.json()["name"] == "Ovos"
    session.refresh(eggs)
    assert eggs.unit == "duzia"


@pytest.mark.parametrize("unit", [None, "caixa"])
def test_update_refuses_a_null_or_unknown_unit(
    client: TestClient, session: Session, farmer: Farmer, unit: str | None
):
    eggs = add_product(session, farmer, name="Ovos")

    response = client.patch(f"/api/products/{eggs.public_id}", json={"unit": unit})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    session.refresh(eggs)
    assert eggs.unit == "kg"


def test_upgrade_sells_existing_products_by_kilo(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    url = f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    command.upgrade(alembic_config(), "c8940e9e4b4c")
    engine = create_engine(url)
    with engine.begin() as connection:
        # SQL cru, porque o model Product descreve o schema do head
        connection.execute(
            text("INSERT INTO users (email, name, created_at) VALUES ('j@x.com', 'J', 0)")
        )
        connection.execute(
            text("INSERT INTO farmers (public_id, zip_code, user_id) VALUES (:id, '01310200', 1)"),
            {"id": uuid4().hex},
        )
        connection.execute(
            text(
                "INSERT INTO products (public_id, name, quantity, price, expiration_date, "
                "created_at, farmer_id, is_available) "
                "VALUES (:id, 'Alface', 5, 3, '2030-01-01', 0, 1, 1)"
            ),
            {"id": uuid4().hex},
        )

    command.upgrade(alembic_config(), "8b1c98fb0e68")

    with engine.connect() as connection:
        units = connection.execute(text("SELECT unit FROM products")).scalars().all()
    engine.dispose()

    assert units == ["kg"]
