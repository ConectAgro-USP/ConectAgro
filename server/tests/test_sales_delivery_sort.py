from datetime import UTC, date, datetime

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.purchase import PurchaseStatus
from tests.helpers import add_product, add_purchase, login

URL = "/api/farmers/me/sales"


def sale(
    session: Session, building: Apartment, farmer: Farmer, quantity: int, delivery: date, **extra
) -> None:
    product = add_product(session, farmer, f"Produto {quantity}")
    purchase = add_purchase(session, building, (product, quantity), **extra)
    purchase.expected_delivery_date = delivery
    session.commit()


def moment(day: int) -> datetime:
    return datetime(2026, 5, day, 12, tzinfo=UTC)


@pytest.fixture
def sales(session: Session, building: Apartment, joao: Farmer) -> None:
    # a quantidade identifica cada venda nas respostas
    sale(session, building, joao, 1, date(2026, 5, 20), created_at=moment(1))
    sale(session, building, joao, 2, date(2026, 5, 10), created_at=moment(3))
    sale(session, building, joao, 3, date(2026, 5, 10), created_at=moment(2))
    delivered = {"created_at": moment(4), "status": PurchaseStatus.ENTREGUE}
    sale(session, building, joao, 4, date(2026, 5, 15), **delivered)


def quantities(client: TestClient, joao: Farmer, **params) -> list[int]:
    login(client, joao.user)
    response = client.get(URL, params=params)
    assert response.status_code == status.HTTP_200_OK
    return [sale["purchase_products"][0]["quantity"] for sale in response.json()["items"]]


@pytest.mark.usefixtures("sales")
def test_delivery_sort_puts_the_nearest_delivery_first(client: TestClient, joao: Farmer):
    # no empate da data, a venda feita antes vem antes
    assert quantities(client, joao, sort="delivery") == [3, 2, 4, 1]


@pytest.mark.usefixtures("sales")
@pytest.mark.parametrize("params", [{}, {"sort": "recent"}], ids=["padrao", "recent"])
def test_default_sort_keeps_the_newest_sale_first(
    client: TestClient, joao: Farmer, params: dict
):
    assert quantities(client, joao, **params) == [4, 2, 3, 1]


@pytest.mark.usefixtures("sales")
def test_delivery_sort_keeps_the_filters_and_the_pages(client: TestClient, joao: Farmer):
    open_sales = {"sort": "delivery", "status": "EM PROGRESSO"}

    first = quantities(client, joao, **open_sales, page=1, page_size=2)
    second = quantities(client, joao, **open_sales, page=2, page_size=2)

    assert (first, second) == ([3, 2], [1])


@pytest.mark.usefixtures("sales")
def test_delivery_sort_does_not_change_the_totals(client: TestClient, joao: Farmer):
    login(client, joao.user)

    recent = client.get(URL).json()
    by_delivery = client.get(URL, params={"sort": "delivery"}).json()

    for key in ("total", "realized_total", "expected_total", "counterparts"):
        assert by_delivery[key] == recent[key]


def test_unknown_sort_is_refused(client: TestClient, joao: Farmer):
    login(client, joao.user)

    response = client.get(URL, params={"sort": "price"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
