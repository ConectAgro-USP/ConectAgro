from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from src.models.user import User
from tests.helpers import add_farmer, add_user, login

TODAY = datetime.now(BUSINESS_TZ).date()
FUTURE = TODAY + timedelta(days=30)
PAST = TODAY - timedelta(days=1)
LETTUCE = {
    "name": "Alface",
    "description": "Alface crespa",
    "picture_url": "https://example.com/alface.png",
    "quantity": 10,
    "price": "2.50",
    "expiration_date": FUTURE.isoformat(),
}


@pytest.fixture
def farmer(client: TestClient, session: Session) -> Farmer:
    user = add_user(session, "joao@example.com", name="João Silva")
    farmer = add_farmer(session, user)
    login(client, user)
    return farmer


def test_farmer_creates_product(client: TestClient, session: Session, farmer: Farmer):
    response = client.post("/api/products", json=LETTUCE)

    body = response.json()
    assert response.status_code == status.HTTP_201_CREATED
    assert body["name"] == "Alface"
    assert body["description"] == "Alface crespa"
    assert body["picture_url"] == "https://example.com/alface.png"
    assert body["quantity"] == 10
    assert body["price"] == "2.50"
    assert body["expiration_date"] == FUTURE.isoformat()
    assert body["farmer_public_id"] == str(farmer.public_id)
    assert body["public_id"] is not None
    assert body["created_at"] is not None
    assert "id" not in body
    assert "farmer_id" not in body

    product = session.exec(select(Product)).one()
    assert str(product.public_id) == body["public_id"]
    assert product.farmer_id == farmer.id


def test_create_product_accepts_only_the_required_fields(client: TestClient, farmer: Farmer):
    minimal = {"name": "Couve", "quantity": 0, "price": "0", "expiration_date": TODAY.isoformat()}

    response = client.post("/api/products", json=minimal)

    body = response.json()
    assert response.status_code == status.HTTP_201_CREATED
    assert body["description"] is None
    assert body["picture_url"] is None
    assert body["farmer_public_id"] == str(farmer.public_id)


def test_create_product_ignores_farmer_sent_in_the_body(
    client: TestClient, session: Session, farmer: Farmer
):
    other_farmer = add_farmer(session, add_user(session, "outro@example.com"))
    payload = {**LETTUCE, "farmer_public_id": str(other_farmer.public_id), "farmer_id": 999}

    response = client.post("/api/products", json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["farmer_public_id"] == str(farmer.public_id)
    assert session.exec(select(Product)).one().farmer_id == farmer.id


@pytest.mark.usefixtures("farmer")
def test_create_product_ignores_public_id_sent_in_the_body(client: TestClient):
    chosen_id = str(uuid4())

    response = client.post("/api/products", json={**LETTUCE, "public_id": chosen_id})

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["public_id"] != chosen_id


def test_create_product_requires_login(client: TestClient, session: Session):
    response = client.post("/api/products", json=LETTUCE)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert session.exec(select(Product)).all() == []


@pytest.mark.usefixtures("ana")
def test_create_product_requires_a_farmer_profile(client: TestClient, session: Session):
    response = client.post("/api/products", json=LETTUCE)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Acesso permitido apenas para agricultores"}
    assert session.exec(select(Product)).all() == []


@pytest.mark.usefixtures("building")
def test_manager_cannot_create_product(client: TestClient, session: Session, manager: User):
    login(client, manager)

    response = client.post("/api/products", json=LETTUCE)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert session.exec(select(Product)).all() == []


@pytest.mark.usefixtures("farmer")
def test_create_product_rejects_expired_product_with_message(client: TestClient):
    response = client.post("/api/products", json={**LETTUCE, "expiration_date": PAST.isoformat()})

    error = response.json()["detail"][0]
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert error["loc"] == ["body", "expiration_date"]
    assert "Não é possível cadastrar produto vencido" in error["msg"]


@pytest.mark.parametrize(
    "field, value",
    [
        ("name", ""),
        ("name", "   "),
        ("name", "A" * 101),
        ("name", "Alf\x00ace"),
        ("description", "D" * 1001),
        ("description", "Alface\x00crespa"),
        ("picture_url", "https://example.com/" + "a" * 2029),
        ("picture_url", "https://example.com/\x00.png"),
        ("quantity", -1),
        ("quantity", 2**31),
        ("price", "-0.01"),
        ("price", "1.234"),
        ("price", "1000000.00"),
        ("expiration_date", "amanhã"),
    ],
)
@pytest.mark.usefixtures("farmer")
def test_create_product_rejects_invalid_field(
    client: TestClient, session: Session, field: str, value: object
):
    response = client.post("/api/products", json={**LETTUCE, field: value})

    error = response.json()["detail"][0]
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert error["loc"] == ["body", field]
    assert error["msg"]
    assert session.exec(select(Product)).all() == []


@pytest.mark.usefixtures("farmer")
def test_create_product_rejects_null_character_with_message(client: TestClient):
    # o SQLite dos testes grava o caractere nulo; o PostgreSQL o recusa e daria erro 500
    response = client.post("/api/products", json={**LETTUCE, "name": "Alf\x00ace"})

    error = response.json()["detail"][0]
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert error["loc"] == ["body", "name"]
    assert "O texto tem um caractere inválido" in error["msg"]


@pytest.mark.usefixtures("farmer")
def test_create_product_saves_texts_without_surrounding_spaces(
    client: TestClient, session: Session
):
    payload = {**LETTUCE, "name": "  Alface  ", "description": " Alface crespa\n"}

    response = client.post("/api/products", json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["name"] == "Alface"
    product = session.exec(select(Product)).one()
    assert product.name == "Alface"
    assert product.description == "Alface crespa"


@pytest.mark.parametrize("field", ["name", "quantity", "price", "expiration_date"])
@pytest.mark.usefixtures("farmer")
def test_create_product_requires_field(client: TestClient, field: str):
    payload = {key: value for key, value in LETTUCE.items() if key != field}

    response = client.post("/api/products", json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["body", field]
