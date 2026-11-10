from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.interest import Interest
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import Purchase, PurchasePart, PurchaseProduct
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_resident, add_user, login

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
    # comparar os dicionários também garante que nenhuma informação a mais vaza
    assert body["farmer"] == {
        "public_id": str(farmer.public_id),
        "farm_name": "Sítio Boa Vista",
        "short_name": "João S.",
        "picture_url": "https://example.com/joao.png",
    }
    assert "11957249062" not in response.text
    assert "1140028922" not in response.text


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


def test_get_product_requires_login(client: TestClient, session: Session, seller: Farmer):
    lettuce = add_product(session, seller)

    response = client.get(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Alface" not in response.text


def test_catalog_requires_login(client: TestClient, session: Session, seller: Farmer):
    add_product(session, seller)

    response = client.get("/api/products")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Alface" not in response.text


FIRST_DAY = datetime(2026, 1, 1, tzinfo=UTC)


def add_products_in_order(session: Session, farmer: Farmer, *names: str) -> list[Product]:
    return [
        add_product(session, farmer, name=name, created_at=FIRST_DAY + timedelta(days=day))
        for day, name in enumerate(names)
    ]


@contextmanager
def recorded_queries(session: Session) -> Iterator[list[str]]:
    queries: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    engine = session.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield queries
    finally:
        event.remove(engine, "before_cursor_execute", record)


@pytest.mark.usefixtures("ana")
def test_catalog_lists_products_of_every_farmer(
    client: TestClient, session: Session, seller: Farmer
):
    maria = add_farmer(session, add_user(session, "maria@example.com", name="Maria Souza"))
    lettuce = add_product(session, seller, name="Alface", created_at=FIRST_DAY)
    potato = add_product(
        session,
        maria,
        name="Batata",
        description="Batata inglesa",
        quantity=3,
        price=Decimal("4.90"),
        created_at=FIRST_DAY + timedelta(days=1),
    )

    response = client.get("/api/products")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    for item in body:
        assert item.pop("created_at") is not None
    assert body == [
        {
            "public_id": str(lettuce.public_id),
            "name": "Alface",
            "description": None,
            "picture_url": None,
            "quantity": 10,
            "price": "2.50",
            "expiration_date": FUTURE.isoformat(),
            "farmer_public_id": str(seller.public_id),
            "farmer_short_name": "João S.",
        },
        {
            "public_id": str(potato.public_id),
            "name": "Batata",
            "description": "Batata inglesa",
            "picture_url": None,
            "quantity": 3,
            "price": "4.90",
            "expiration_date": FUTURE.isoformat(),
            "farmer_public_id": str(maria.public_id),
            "farmer_short_name": "Maria S.",
        },
    ]


@pytest.mark.usefixtures("ana")
def test_catalog_is_empty_without_products(client: TestClient):
    response = client.get("/api/products")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


@pytest.mark.usefixtures("ana")
def test_catalog_hides_expired_and_sold_out_products(
    client: TestClient, session: Session, seller: Farmer
):
    add_product(session, seller, name="Alface")
    add_product(session, seller, name="Couve vencida", expiration_date=PAST)
    add_product(session, seller, name="Batata esgotada", quantity=0)

    response = client.get("/api/products")

    assert response.status_code == status.HTTP_200_OK
    assert [product["name"] for product in response.json()] == ["Alface"]


@pytest.mark.parametrize(
    "overrides",
    [{"expiration_date": TODAY}, {"quantity": 1}],
    ids=["vence-hoje", "ultima-unidade"],
)
@pytest.mark.usefixtures("ana")
def test_catalog_shows_products_at_the_limit(
    client: TestClient, session: Session, seller: Farmer, overrides: dict
):
    # o cadastro aceita produto que vence hoje, então ele ainda está na validade
    product = add_product(session, seller, **overrides)

    response = client.get("/api/products")

    assert [item["public_id"] for item in response.json()] == [str(product.public_id)]


@pytest.mark.usefixtures("ana")
def test_catalog_orders_by_creation_date(client: TestClient, session: Session, seller: Farmer):
    add_product(session, seller, name="Couve", created_at=FIRST_DAY + timedelta(days=2))
    add_product(session, seller, name="Alface", created_at=FIRST_DAY)
    add_product(session, seller, name="Rúcula", created_at=FIRST_DAY + timedelta(days=1))

    response = client.get("/api/products")

    assert [product["name"] for product in response.json()] == ["Alface", "Rúcula", "Couve"]


@pytest.mark.usefixtures("ana")
def test_catalog_breaks_ties_by_public_id(client: TestClient, session: Session, seller: Farmer):
    # sem desempate, o banco pode trocar a ordem entre as páginas e repetir um produto
    add_product(session, seller, name="Couve", created_at=FIRST_DAY, public_id=UUID(int=2))
    add_product(session, seller, name="Alface", created_at=FIRST_DAY, public_id=UUID(int=1))

    response = client.get("/api/products")

    assert [product["name"] for product in response.json()] == ["Alface", "Couve"]


@pytest.mark.usefixtures("ana")
def test_catalog_paginates_without_repeating_products(
    client: TestClient, session: Session, seller: Farmer
):
    add_products_in_order(session, seller, "Alface", "Batata", "Couve", "Rúcula", "Tomate")

    pages = [
        [
            product["name"]
            for product in client.get(
                "/api/products", params={"limit": 2, "offset": offset}
            ).json()
        ]
        for offset in (0, 2, 4, 6)
    ]

    assert pages == [["Alface", "Batata"], ["Couve", "Rúcula"], ["Tomate"], []]


@pytest.mark.usefixtures("ana")
def test_catalog_pages_count_only_available_products(
    client: TestClient, session: Session, seller: Farmer
):
    add_product(session, seller, name="Alface", created_at=FIRST_DAY)
    add_product(
        session,
        seller,
        name="Couve vencida",
        expiration_date=PAST,
        created_at=FIRST_DAY + timedelta(days=1),
    )
    add_product(session, seller, name="Batata", created_at=FIRST_DAY + timedelta(days=2))

    response = client.get("/api/products", params={"limit": 2})

    assert [product["name"] for product in response.json()] == ["Alface", "Batata"]


@pytest.mark.usefixtures("ana")
def test_catalog_returns_10_products_by_default(
    client: TestClient, session: Session, seller: Farmer
):
    add_products_in_order(session, seller, *[f"Produto {number}" for number in range(12)])

    response = client.get("/api/products")

    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 10


@pytest.mark.parametrize("limit", [1, 100])
@pytest.mark.usefixtures("ana")
def test_catalog_accepts_limit_from_1_to_100(
    client: TestClient, session: Session, seller: Farmer, limit: int
):
    add_products_in_order(session, seller, "Alface", "Couve")

    response = client.get("/api/products", params={"limit": limit})

    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == min(limit, 2)


@pytest.mark.parametrize(
    "params, field",
    [
        ({"limit": 0}, "limit"),
        ({"limit": 101}, "limit"),
        ({"limit": "dez"}, "limit"),
        ({"offset": -1}, "offset"),
        ({"offset": "zero"}, "offset"),
    ],
)
@pytest.mark.usefixtures("ana")
def test_catalog_rejects_invalid_pagination(client: TestClient, params: dict, field: str):
    response = client.get("/api/products", params=params)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["query", field]


@pytest.mark.usefixtures("ana")
def test_catalog_hides_email_saved_as_farmer_name(client: TestClient, session: Session):
    # sem o nome do Google, o cadastro guarda o e-mail no lugar do nome
    farmer = add_farmer(session, add_user(session, "joao@example.com", name="joao@example.com"))
    add_product(session, farmer)

    response = client.get("/api/products")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()[0]["farmer_short_name"] == ""
    assert "joao@example.com" not in response.text


@pytest.mark.usefixtures("ana")
def test_catalog_queries_do_not_grow_with_the_number_of_products(
    client: TestClient, session: Session
):
    def add_farmer_with_product(number: int) -> None:
        user = add_user(session, f"agricultor{number}@example.com", name=f"Agricultor {number}")
        add_product(session, add_farmer(session, user))

    add_farmer_with_product(0)
    with recorded_queries(session) as one_product:
        client.get("/api/products")
    for number in range(1, 6):
        add_farmer_with_product(number)
    with recorded_queries(session) as six_products:
        response = client.get("/api/products")

    assert len(response.json()) == 6
    assert len(six_products) == len(one_product)


def test_owner_updates_only_the_fields_sent(
    client: TestClient, session: Session, farmer: Farmer
):
    lettuce = add_product(session, farmer, description="Alface crespa")

    response = client.patch(
        f"/api/products/{lettuce.public_id}", json={"price": "3.00", "quantity": 4}
    )

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body.pop("created_at") is not None
    assert body == {
        "public_id": str(lettuce.public_id),
        "name": "Alface",
        "description": "Alface crespa",
        "picture_url": None,
        "quantity": 4,
        "price": "3.00",
        "expiration_date": FUTURE.isoformat(),
        "farmer_public_id": str(farmer.public_id),
    }
    session.refresh(lettuce)
    assert lettuce.price == Decimal("3.00")
    assert lettuce.quantity == 4
    assert lettuce.description == "Alface crespa"


def test_owner_updates_every_field(client: TestClient, session: Session, farmer: Farmer):
    lettuce = add_product(session, farmer)
    changes = {
        "name": "Alface roxa",
        "description": "Alface roxa orgânica",
        "picture_url": "https://example.com/alface-roxa.png",
        "quantity": 3,
        "price": "4.75",
        "expiration_date": (TODAY + timedelta(days=5)).isoformat(),
    }

    response = client.patch(f"/api/products/{lettuce.public_id}", json=changes)

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body.pop("created_at") is not None
    assert body == {
        **changes,
        "public_id": str(lettuce.public_id),
        "farmer_public_id": str(farmer.public_id),
    }


@pytest.mark.parametrize(
    "field, value",
    [("quantity", 0), ("price", "0.00"), ("expiration_date", TODAY.isoformat())],
    ids=["esgotado", "gratis", "vence-hoje"],
)
def test_owner_sets_values_at_the_limit(
    client: TestClient, session: Session, farmer: Farmer, field: str, value: object
):
    lettuce = add_product(session, farmer)

    response = client.patch(f"/api/products/{lettuce.public_id}", json={field: value})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()[field] == value


def test_owner_clears_optional_fields_with_null(
    client: TestClient, session: Session, farmer: Farmer
):
    lettuce = add_product(
        session, farmer, description="Alface crespa", picture_url="https://example.com/a.png"
    )

    response = client.patch(
        f"/api/products/{lettuce.public_id}", json={"description": None, "picture_url": None}
    )

    assert response.status_code == status.HTTP_200_OK
    session.refresh(lettuce)
    assert lettuce.description is None
    assert lettuce.picture_url is None
    assert lettuce.name == "Alface"


def test_update_with_empty_body_changes_nothing(
    client: TestClient, session: Session, farmer: Farmer
):
    lettuce = add_product(session, farmer, description="Alface crespa")

    response = client.patch(f"/api/products/{lettuce.public_id}", json={})

    assert response.status_code == status.HTTP_200_OK
    session.refresh(lettuce)
    assert lettuce.name == "Alface"
    assert lettuce.description == "Alface crespa"
    assert lettuce.price == Decimal("2.50")
    assert lettuce.quantity == 10


def test_update_saves_texts_without_surrounding_spaces(
    client: TestClient, session: Session, farmer: Farmer
):
    lettuce = add_product(session, farmer)

    response = client.patch(
        f"/api/products/{lettuce.public_id}",
        json={"name": "  Alface roxa  ", "description": "  Orgânica  "},
    )

    assert response.status_code == status.HTTP_200_OK
    session.refresh(lettuce)
    assert lettuce.name == "Alface roxa"
    assert lettuce.description == "Orgânica"


def test_update_ignores_owner_and_ids_sent_in_the_body(
    client: TestClient, session: Session, farmer: Farmer, seller: Farmer
):
    lettuce = add_product(session, farmer)
    original_public_id = lettuce.public_id
    original_created_at = lettuce.created_at

    response = client.patch(
        f"/api/products/{lettuce.public_id}",
        json={
            "price": "3.00",
            "farmer_public_id": str(seller.public_id),
            "farmer_id": seller.id,
            "public_id": str(uuid4()),
            "created_at": "2020-01-01T00:00:00Z",
            "id": 999,
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["farmer_public_id"] == str(farmer.public_id)
    session.refresh(lettuce)
    assert lettuce.farmer_id == farmer.id
    assert lettuce.public_id == original_public_id
    assert lettuce.created_at == original_created_at
    assert lettuce.price == Decimal("3.00")


def test_owner_renews_an_expired_product(client: TestClient, session: Session, farmer: Farmer):
    lettuce = add_product(session, farmer, expiration_date=PAST)

    response = client.patch(
        f"/api/products/{lettuce.public_id}", json={"expiration_date": FUTURE.isoformat()}
    )

    assert response.status_code == status.HTTP_200_OK
    catalog = client.get("/api/products").json()
    assert [product["public_id"] for product in catalog] == [str(lettuce.public_id)]


def test_update_product_requires_login(client: TestClient, session: Session, seller: Farmer):
    lettuce = add_product(session, seller)

    response = client.patch(f"/api/products/{lettuce.public_id}", json={"price": "9.99"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    session.refresh(lettuce)
    assert lettuce.price == Decimal("2.50")


@pytest.mark.usefixtures("ana")
def test_update_product_requires_a_farmer_profile(
    client: TestClient, session: Session, seller: Farmer
):
    lettuce = add_product(session, seller)

    response = client.patch(f"/api/products/{lettuce.public_id}", json={"price": "9.99"})

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Acesso permitido apenas para agricultores"}
    session.refresh(lettuce)
    assert lettuce.price == Decimal("2.50")


@pytest.mark.usefixtures("farmer")
def test_farmer_cannot_update_product_of_another_farmer(
    client: TestClient, session: Session, seller: Farmer
):
    lettuce = add_product(session, seller)

    response = client.patch(f"/api/products/{lettuce.public_id}", json={"price": "9.99"})

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você só pode alterar seus produtos"}
    session.refresh(lettuce)
    assert lettuce.price == Decimal("2.50")


@pytest.mark.usefixtures("farmer")
def test_update_unknown_product_returns_404(client: TestClient):
    response = client.patch(f"/api/products/{uuid4()}", json={"price": "3.00"})

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Produto não encontrado"}


@pytest.mark.usefixtures("farmer")
def test_update_product_rejects_invalid_id(client: TestClient):
    response = client.patch("/api/products/abc", json={"price": "3.00"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["path", "public_id"]


@pytest.mark.parametrize(
    "field, value",
    [
        ("name", ""),
        ("name", None),
        ("quantity", -1),
        ("quantity", 2**31),
        ("quantity", None),
        ("price", "-0.01"),
        ("price", "1.234"),
        ("price", "1000000.00"),
        ("price", None),
        ("expiration_date", PAST.isoformat()),
        ("expiration_date", None),
        ("expiration_date", "amanhã"),
    ],
)
def test_update_product_rejects_invalid_field(
    client: TestClient, session: Session, farmer: Farmer, field: str, value: object
):
    lettuce = add_product(session, farmer)

    response = client.patch(f"/api/products/{lettuce.public_id}", json={field: value})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["body", field]
    session.refresh(lettuce)
    assert lettuce.name == "Alface"
    assert lettuce.quantity == 10
    assert lettuce.price == Decimal("2.50")
    assert lettuce.expiration_date == FUTURE


@pytest.mark.parametrize(
    "changes, message",
    [
        ({"expiration_date": PAST.isoformat()}, "Atualização faz com que o produto esteja fora"),
        ({"name": "Alf\x00ace"}, "O texto tem um caractere inválido"),
    ],
    ids=["vencido", "caractere-nulo"],
)
def test_update_product_explains_the_error(
    client: TestClient, session: Session, farmer: Farmer, changes: dict, message: str
):
    lettuce = add_product(session, farmer)

    response = client.patch(f"/api/products/{lettuce.public_id}", json=changes)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert message in response.json()["detail"][0]["msg"]


def add_purchase(session: Session, building: Apartment, product: Product) -> PurchaseProduct:
    purchase = Purchase(apartment_id=building.id, expected_delivery_date=FUTURE)
    session.add(purchase)
    session.commit()
    part = PurchasePart(purchase_id=purchase.id, farmer_id=product.farmer_id)
    session.add(part)
    session.commit()
    item = PurchaseProduct(
        purchase_part_id=part.id, product_id=product.id, quantity=1, unit_price=product.price
    )
    session.add(item)
    session.commit()
    return item


def test_owner_cannot_remove_a_product_already_sold(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    lettuce = add_product(session, farmer)
    add_purchase(session, building, lettuce)

    response = client.delete(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "detail": "Este produto já foi vendido e não pode ser removido. "
        "Zere a quantidade para tirá-lo do catálogo"
    }
    session.expire_all()
    assert session.get(Product, lettuce.id) is not None
    assert len(session.exec(select(PurchaseProduct)).all()) == 1


@pytest.mark.usefixtures("farmer")
def test_another_farmer_gets_403_and_not_409_for_a_sold_product(
    client: TestClient, session: Session, seller: Farmer, building: Apartment
):
    # quem não é o dono não pode descobrir se o produto já foi vendido
    lettuce = add_product(session, seller)
    add_purchase(session, building, lettuce)

    response = client.delete(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_sale_of_another_product_does_not_block_removal(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    sold = add_product(session, farmer, name="Alface")
    add_purchase(session, building, sold)
    unsold = add_product(session, farmer, name="Couve")
    sold_id, unsold_id = sold.id, unsold.id

    response = client.delete(f"/api/products/{unsold.public_id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    session.expire_all()
    assert session.get(Product, unsold_id) is None
    assert session.get(Product, sold_id) is not None


def test_farmer_follows_the_409_message_to_hide_a_sold_product(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    # a mensagem do 409 manda zerar a quantidade; o teste segue esse caminho até o fim
    lettuce = add_product(session, farmer)
    add_purchase(session, building, lettuce)
    url = f"/api/products/{lettuce.public_id}"

    removal = client.delete(url)
    assert removal.status_code == status.HTTP_409_CONFLICT
    assert "Zere a quantidade" in removal.json()["detail"]

    response = client.patch(url, json={"quantity": 0})

    assert response.status_code == status.HTTP_200_OK
    assert client.get("/api/products").json() == []
    # some do catálogo, mas continua com o agricultor e no histórico da compra
    assert [product["public_id"] for product in client.get("/api/products/me").json()] == [
        str(lettuce.public_id)
    ]
    assert len(session.exec(select(PurchaseProduct)).all()) == 1


def test_owner_removes_product(client: TestClient, session: Session, farmer: Farmer):
    lettuce = add_product(session, farmer, name="Alface")
    kale = add_product(session, farmer, name="Couve")
    lettuce_id, lettuce_url = lettuce.id, f"/api/products/{lettuce.public_id}"

    response = client.delete(lettuce_url)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert response.content == b""
    session.expire_all()
    assert session.get(Product, lettuce_id) is None
    assert session.get(Product, kale.id) is not None
    assert [product["name"] for product in client.get("/api/products/me").json()] == ["Couve"]
    assert [product["name"] for product in client.get("/api/products").json()] == ["Couve"]
    assert client.get(lettuce_url).status_code == status.HTTP_404_NOT_FOUND


def test_removing_a_product_removes_only_its_interests(
    client: TestClient, session: Session, farmer: Farmer, building: Apartment
):
    lettuce = add_product(session, farmer, name="Alface")
    kale = add_product(session, farmer, name="Couve")
    resident = add_resident(session, building, add_user(session, "bia@example.com"))
    session.add(Interest(buyer_id=resident.id, product_id=lettuce.id, quantity=2))
    session.add(Interest(buyer_id=resident.id, product_id=kale.id, quantity=1))
    session.commit()

    response = client.delete(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    session.expire_all()
    interests = session.exec(select(Interest)).all()
    assert [interest.product_id for interest in interests] == [kale.id]


def test_remove_product_requires_login(client: TestClient, session: Session, seller: Farmer):
    lettuce = add_product(session, seller)

    response = client.delete(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    session.expire_all()
    assert session.get(Product, lettuce.id) is not None


@pytest.mark.usefixtures("ana")
def test_remove_product_requires_a_farmer_profile(
    client: TestClient, session: Session, seller: Farmer
):
    lettuce = add_product(session, seller)

    response = client.delete(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Acesso permitido apenas para agricultores"}
    session.expire_all()
    assert session.get(Product, lettuce.id) is not None


@pytest.mark.usefixtures("farmer")
def test_farmer_cannot_remove_product_of_another_farmer(
    client: TestClient, session: Session, seller: Farmer
):
    lettuce = add_product(session, seller)

    response = client.delete(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você só pode deletar seus produtos"}
    session.expire_all()
    assert session.get(Product, lettuce.id) is not None


@pytest.mark.usefixtures("farmer")
def test_remove_unknown_product_returns_404(client: TestClient):
    response = client.delete(f"/api/products/{uuid4()}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Produto não encontrado"}


def test_remove_product_twice_returns_404(client: TestClient, session: Session, farmer: Farmer):
    lettuce = add_product(session, farmer)
    client.delete(f"/api/products/{lettuce.public_id}")

    response = client.delete(f"/api/products/{lettuce.public_id}")

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.usefixtures("farmer")
def test_remove_product_rejects_invalid_id(client: TestClient):
    response = client.delete("/api/products/abc")

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"][0]["loc"] == ["path", "public_id"]
