from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_user, login

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


def test_farmer_lists_own_products(client: TestClient, session: Session, farmer: Farmer):
    lettuce = add_product(session, farmer, name="Alface")
    add_product(session, farmer, name="Couve")
    other_farmer = add_farmer(session, add_user(session, "maria@example.com"))
    add_product(session, other_farmer, name="Batata")

    response = client.get("/api/products/me")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert sorted(product["name"] for product in body) == ["Alface", "Couve"]
    listed_lettuce = next(product for product in body if product["name"] == "Alface")
    assert listed_lettuce["public_id"] == str(lettuce.public_id)
    assert listed_lettuce["farmer_public_id"] == str(farmer.public_id)
    assert listed_lettuce["price"] == "2.50"
    assert "id" not in listed_lettuce
    assert "farmer_id" not in listed_lettuce


def test_list_my_products_is_empty_when_farmer_has_none(
    client: TestClient, session: Session, farmer: Farmer
):
    other_farmer = add_farmer(session, add_user(session, "maria@example.com"))
    add_product(session, other_farmer, name="Batata")

    response = client.get("/api/products/me")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_list_my_products_includes_expired_and_sold_out(
    client: TestClient, session: Session, farmer: Farmer
):
    add_product(session, farmer, name="Alface vencida", expiration_date=PAST)
    add_product(session, farmer, name="Couve esgotada", quantity=0)

    response = client.get("/api/products/me")

    assert response.status_code == status.HTTP_200_OK
    assert sorted(product["name"] for product in response.json()) == [
        "Alface vencida",
        "Couve esgotada",
    ]


def test_list_my_products_orders_by_creation_date(
    client: TestClient, session: Session, farmer: Farmer
):
    first_day = datetime(2026, 1, 1, tzinfo=UTC)
    add_product(
        session,
        farmer,
        name="Couve",
        created_at=first_day + timedelta(days=2),
        public_id=UUID(int=1),
    )
    add_product(session, farmer, name="Alface", created_at=first_day, public_id=UUID(int=3))
    add_product(
        session,
        farmer,
        name="Rúcula",
        created_at=first_day + timedelta(days=1),
        public_id=UUID(int=2),
    )

    response = client.get("/api/products/me")

    assert [product["name"] for product in response.json()] == ["Alface", "Rúcula", "Couve"]


def test_list_my_products_requires_login(client: TestClient):
    response = client.get("/api/products/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.usefixtures("ana")
def test_list_my_products_requires_a_farmer_profile(client: TestClient):
    response = client.get("/api/products/me")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Acesso permitido apenas para agricultores"}


@pytest.mark.usefixtures("ana")
def test_get_product_shows_public_data_of_the_farmer(client: TestClient, session: Session):
    user = add_user(session, "joao@example.com", name="João da Silva")
    user.picture_url = "https://example.com/joao.png"
    user.cellphone = "11957249062"
    user.homephone = "1140028922"
    farmer = add_farmer(session, user)
    farmer.farm_name = "Sítio Boa Vista"
    session.commit()
    lettuce = add_product(session, farmer)

    response = client.get(f"/api/products/{lettuce.public_id}")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body["public_id"] == str(lettuce.public_id)
    assert body["name"] == "Alface"
    # os telefones são visíveis porque a compra é combinada pelo WhatsApp
    # comparar os dicionários também garante que nenhuma informação a mais vaza
    assert body["farmer"] == {
        "public_id": str(farmer.public_id),
        "farm_name": "Sítio Boa Vista",
        "short_name": "João S.",
        "picture_url": "https://example.com/joao.png",
        "cellphone": "11957249062",
        "homephone": "1140028922",
    }


@pytest.mark.usefixtures("ana")
def test_get_product_hides_email_saved_as_farmer_name(client: TestClient, session: Session):
    # sem o nome do Google, o cadastro guarda o e-mail no lugar do nome
    user = add_user(session, "joao@example.com", name="joao@example.com")
    lettuce = add_product(session, add_farmer(session, user))

    response = client.get(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["farmer"]["short_name"] == ""
    assert "joao@example.com" not in response.text


@pytest.fixture
def seller(session: Session) -> Farmer:
    # agricultor sem login, para a página do produto ser vista por quem não é o dono
    return add_farmer(session, add_user(session, "sitio@example.com", name="João Silva"))


@pytest.mark.usefixtures("ana")
def test_get_product_returns_every_product_field(
    client: TestClient, session: Session, seller: Farmer
):
    lettuce = add_product(
        session,
        seller,
        description="Alface crespa",
        picture_url="https://example.com/alface.png",
        quantity=7,
        price=Decimal("3.20"),
    )

    response = client.get(f"/api/products/{lettuce.public_id}")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body.pop("created_at") is not None
    assert body.pop("farmer")["public_id"] == str(seller.public_id)
    assert body == {
        "public_id": str(lettuce.public_id),
        "name": "Alface",
        "description": "Alface crespa",
        "picture_url": "https://example.com/alface.png",
        "quantity": 7,
        "price": "3.20",
        "expiration_date": FUTURE.isoformat(),
        "farmer_public_id": str(seller.public_id),
    }


@pytest.mark.usefixtures("ana")
def test_get_product_shows_the_farmer_of_that_product(
    client: TestClient, session: Session, seller: Farmer
):
    maria = add_farmer(session, add_user(session, "maria@example.com", name="Maria Souza"))
    add_product(session, seller, name="Alface")
    potato = add_product(session, maria, name="Batata")

    response = client.get(f"/api/products/{potato.public_id}")

    body = response.json()
    assert body["name"] == "Batata"
    assert body["farmer_public_id"] == str(maria.public_id)
    assert body["farmer"]["public_id"] == str(maria.public_id)
    assert body["farmer"]["short_name"] == "Maria S."


@pytest.mark.usefixtures("ana")
def test_get_product_shows_farmer_without_optional_data(client: TestClient, session: Session):
    farmer = add_farmer(session, add_user(session, "joao@example.com", name="João"))
    lettuce = add_product(session, farmer)

    response = client.get(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["farmer"] == {
        "public_id": str(farmer.public_id),
        "farm_name": None,
        "short_name": "João",
        "picture_url": None,
        "cellphone": None,
        "homephone": None,
    }


@pytest.mark.parametrize(
    "overrides",
    [{"expiration_date": PAST}, {"quantity": 0}],
    ids=["vencido", "esgotado"],
)
@pytest.mark.usefixtures("ana")
def test_get_product_still_shows_expired_and_sold_out(
    client: TestClient, session: Session, seller: Farmer, overrides: dict
):
    product = add_product(session, seller, **overrides)

    response = client.get(f"/api/products/{product.public_id}")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["public_id"] == str(product.public_id)


@pytest.mark.usefixtures("ana")
def test_get_unknown_product_returns_404(client: TestClient, session: Session, seller: Farmer):
    add_product(session, seller)

    response = client.get(f"/api/products/{uuid4()}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Produto não encontrado"}


@pytest.mark.parametrize("public_id", ["abc", "123", "6f1c2b9e-3d4a-4e5f-8a7b"])
@pytest.mark.usefixtures("ana")
def test_get_product_rejects_invalid_id(client: TestClient, public_id: str):
    response = client.get(f"/api/products/{public_id}")

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["path", "public_id"]
