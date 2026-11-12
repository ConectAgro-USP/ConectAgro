from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import Purchase
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_user, login

FUTURE = datetime.now(BUSINESS_TZ).date() + timedelta(days=7)
PAST = FUTURE - timedelta(days=8)


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


@pytest.fixture
def lettuce(session: Session) -> Product:
    joao = add_farmer(session, add_user(session, "joao@example.com"))
    return add_product(session, joao, name="Alface")


@pytest.fixture
def potato(session: Session) -> Product:
    maria = add_farmer(session, add_user(session, "maria@example.com"))
    return add_product(session, maria, name="Batata")


@pytest.fixture
def purchase_url(client: TestClient, lettuce: Product, potato: Product) -> str:
    purchase = buy(client, (lettuce, 4), (potato, 3)).json()
    return f"/api/purchases/{purchase['public_id']}"


def buy(client: TestClient, *items: tuple[Product, int], delivery: date = FUTURE) -> Response:
    payload = {
        "expected_delivery_date": delivery.isoformat(),
        "items": [
            {"product_public_id": str(product.public_id), "quantity": quantity}
            for product, quantity in items
        ],
    }
    return client.post("/api/purchases", json=payload)


def set_status(client: TestClient, farmer: Farmer, purchase_url: str, new_status: str) -> Response:
    login(client, farmer.user)
    return client.patch(f"{purchase_url}/parts/me/status", json={"status": new_status})


def stock_of(session: Session, product: Product) -> int:
    session.refresh(product)
    return product.quantity


def test_manager_creates_purchase_split_by_farmer(
    client: TestClient, session: Session, building: Apartment, lettuce: Product, potato: Product
):
    response = buy(client, (lettuce, 4), (potato, 3))

    body = response.json()
    assert response.status_code == status.HTTP_201_CREATED
    assert body["apartment_public_id"] == str(building.public_id)
    assert body["status"] == "EM PROGRESSO"
    assert body["closed_at"] is None
    lettuce_part, potato_part = body["purchase_parts"]
    assert lettuce_part["farmer_public_id"] == str(lettuce.farmer.public_id)
    assert lettuce_part["status"] == "EM PROGRESSO"
    assert lettuce_part["purchase_products"] == [
        {"product_public_id": str(lettuce.public_id), "quantity": 4, "unit_price": "2.50"}
    ]
    assert potato_part["farmer_public_id"] == str(potato.farmer.public_id)
    assert stock_of(session, lettuce) == 6
    assert stock_of(session, potato) == 7


@pytest.mark.parametrize(
    "delivery, quantities",
    [(PAST, [1]), (FUTURE, [0]), (FUTURE, []), (FUTURE, [1, 1])],
    ids=["data-passada", "quantidade-zero", "sem-itens", "produto-repetido"],
)
def test_create_purchase_rejects_invalid_body(
    client: TestClient, session: Session, lettuce: Product, delivery: date, quantities: list[int]
):
    response = buy(client, *[(lettuce, quantity) for quantity in quantities], delivery=delivery)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert session.exec(select(Purchase)).all() == []
    assert stock_of(session, lettuce) == 10


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"expiration_date": PAST}, "O produto Couve está vencido e não pode ser comprado"),
        ({"quantity": 1}, "O produto Couve não tem a quantidade pedida"),
    ],
    ids=["vencido", "acima-do-estoque"],
)
def test_create_purchase_rejects_unavailable_product(
    client: TestClient, session: Session, lettuce: Product, overrides: dict, message: str
):
    kale = add_product(session, lettuce.farmer, name="Couve", **overrides)

    response = buy(client, (lettuce, 1), (kale, 2))

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {"detail": message}
    assert session.exec(select(Purchase)).all() == []
    assert stock_of(session, lettuce) == 10


def test_create_purchase_with_unknown_product_returns_404(client: TestClient, lettuce: Product):
    response = buy(client, (lettuce, 1), (Product(), 1))

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_farmers_close_their_own_parts(
    client: TestClient, manager: User, lettuce: Product, potato: Product, purchase_url: str
):
    delivered = set_status(client, lettuce.farmer, purchase_url, "ENTREGUE")
    closed_again = set_status(client, lettuce.farmer, purchase_url, "CANCELADA")
    reopened = set_status(client, lettuce.farmer, purchase_url, "EM PROGRESSO")
    farmer_view = client.get(purchase_url).json()
    login(client, manager)
    late_cancel = client.post(f"{purchase_url}/cancel")
    set_status(client, potato.farmer, purchase_url, "ENTREGUE")
    all_delivered = client.get(purchase_url).json()

    assert delivered.status_code == status.HTTP_200_OK
    assert delivered.json()["status"] == "ENTREGUE"
    assert delivered.json()["closed_at"] is not None
    assert closed_again.status_code == status.HTTP_409_CONFLICT
    assert reopened.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert late_cancel.status_code == status.HTTP_409_CONFLICT
    assert farmer_view["purchase_parts"] == [delivered.json()]
    assert farmer_view["status"] == "EM PROGRESSO"
    assert farmer_view["closed_at"] is None
    assert all_delivered["status"] == "ENTREGUE"
    assert all_delivered["closed_at"] is not None


def test_farmer_cancelling_own_part_returns_only_its_stock(
    client: TestClient, session: Session, lettuce: Product, potato: Product, purchase_url: str
):
    response = set_status(client, lettuce.farmer, purchase_url, "CANCELADA")
    set_status(client, potato.farmer, purchase_url, "ENTREGUE")
    purchase = client.get(purchase_url).json()

    assert response.json()["status"] == "CANCELADA"
    assert stock_of(session, lettuce) == 10
    assert stock_of(session, potato) == 7
    # sem parte em aberto a compra fecha, e a entrega da outra parte vale
    assert purchase["status"] == "ENTREGUE"
    assert purchase["closed_at"] is not None


def test_manager_cancels_purchase_and_returns_the_stock_once(
    client: TestClient, session: Session, lettuce: Product, potato: Product, purchase_url: str
):
    response = client.post(f"{purchase_url}/cancel")
    client.post(f"{purchase_url}/cancel")

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert body["status"] == "CANCELADA"
    assert body["closed_at"] is not None
    assert [part["status"] for part in body["purchase_parts"]] == ["CANCELADA", "CANCELADA"]
    assert stock_of(session, lettuce) == 10
    assert stock_of(session, potato) == 10


def test_people_outside_the_purchase_cannot_reach_it(
    client: TestClient, session: Session, other_building: Apartment, purchase_url: str
):
    forbidden = status.HTTP_403_FORBIDDEN
    not_found = status.HTTP_404_NOT_FOUND
    unknown_url = f"/api/purchases/{uuid4()}"
    pedro = add_farmer(session, add_user(session, "pedro@example.com"))
    assert set_status(client, pedro, purchase_url, "ENTREGUE").status_code == forbidden
    assert set_status(client, pedro, unknown_url, "ENTREGUE").status_code == not_found
    assert client.get(purchase_url).status_code == forbidden
    assert client.post("/api/purchases", json={}).status_code == forbidden
    login(client, other_building.manager)
    assert client.get(purchase_url).status_code == forbidden
    assert client.post(f"{purchase_url}/cancel").status_code == forbidden
    assert client.get(unknown_url).status_code == not_found
    assert client.post(f"{unknown_url}/cancel").status_code == not_found
    client.cookies.clear()
    assert client.get(purchase_url).status_code == status.HTTP_401_UNAUTHORIZED
