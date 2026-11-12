from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.product import Product
from src.models.purchase import PurchaseStatus
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_purchase, add_resident, add_user, login

URL = "/api/apartments/me/purchases"


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User) -> None:
    login(client, manager)


@pytest.fixture
def lettuce(session: Session) -> Product:
    joao = add_farmer(session, add_user(session, "joao@example.com", name="João Lima"))
    return add_product(session, joao, name="Alface")


@pytest.fixture
def potato(session: Session) -> Product:
    maria = add_farmer(session, add_user(session, "maria@example.com"))
    return add_product(session, maria, name="Batata", price=Decimal("4.00"))


@pytest.fixture
def purchases(
    session: Session,
    building: Apartment,
    other_building: Apartment,
    lettuce: Product,
    potato: Product,
):
    delivered = PurchaseStatus.ENTREGUE
    cancelled = PurchaseStatus.CANCELADA
    january = datetime(2026, 1, 10, 12, tzinfo=UTC)
    # 2 horas em UTC ainda é o dia 10 em Brasília
    february = datetime(2026, 2, 11, 2, tzinfo=UTC)
    march = datetime(2026, 3, 10, 12, tzinfo=UTC)
    add_purchase(session, building, (lettuce, 1), (potato, 1), status=delivered, created_at=january)
    mixed = add_purchase(session, building, (lettuce, 2), (potato, 2), created_at=february)
    mixed.purchase_parts[1].status = cancelled
    closed = add_purchase(session, building, (lettuce, 3), (potato, 1), created_at=january)
    closed.purchase_parts[0].status, closed.purchase_parts[1].status = delivered, cancelled
    session.commit()
    add_purchase(session, building, (potato, 3), status=cancelled, created_at=march)
    add_purchase(session, other_building, (lettuce, 4), status=delivered, created_at=march)


def test_manager_sees_purchase_with_parts_items_and_totals(
    client: TestClient, session: Session, building: Apartment, lettuce: Product
):
    purchase = add_purchase(session, building, (lettuce, 4))
    part = purchase.purchase_parts[0]

    response = client.get(URL)

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert (body["total"], body["page"], body["page_size"], body["total_pages"]) == (1, 1, 20, 1)
    assert (body["realized_total"], body["expected_total"]) == ("0.00", "10.00")
    [item] = body["items"]
    assert item.pop("created_at").startswith(purchase.created_at.date().isoformat())
    assert item == {
        "public_id": str(purchase.public_id),
        "apartment_public_id": str(building.public_id),
        "expected_delivery_date": "2030-01-01",
        "status": "EM PROGRESSO",
        "closed_at": None,
        "total": "10.00",
        "purchase_parts": [
            {
                "public_id": str(part.public_id),
                "farmer_public_id": str(lettuce.farmer.public_id),
                "farmer_short_name": "João L.",
                "status": "EM PROGRESSO",
                "closed_at": None,
                "total": "10.00",
                "purchase_products": [
                    {
                        "product_public_id": str(lettuce.public_id),
                        "product_name": "Alface",
                        "quantity": 4,
                        "unit_price": "2.50",
                        "subtotal": "10.00",
                    }
                ],
            }
        ],
    }


@pytest.mark.parametrize(
    "params, purchase_totals, realized, expected",
    [
        ({}, ["0.00", "5.00", "7.50", "6.50"], "14.00", "5.00"),
        ({"status": "ENTREGUE"}, ["7.50", "6.50"], "14.00", "5.00"),
        ({"status": "EM PROGRESSO"}, ["5.00"], "14.00", "5.00"),
        ({"status": "CANCELADA"}, ["0.00"], "14.00", "5.00"),
        ({"date_from": "2026-02-10"}, ["0.00", "5.00"], "0.00", "5.00"),
        ({"date_from": "2026-02-11"}, ["0.00"], "0.00", "0.00"),
        ({"date_to": "2026-02-10"}, ["5.00", "7.50", "6.50"], "14.00", "5.00"),
        ({"page": 2, "page_size": 1}, ["5.00"], "14.00", "5.00"),
    ],
    ids=["tudo", "entregue", "em-progresso", "cancelada", "desde", "depois", "ate", "pagina"],
)
@pytest.mark.usefixtures("purchases")
def test_filters_change_the_list_and_status_and_page_keep_the_totals(
    client: TestClient, params: dict, purchase_totals: list[str], realized: str, expected: str
):
    body = client.get(URL, params=params).json()

    assert [purchase["total"] for purchase in body["items"]] == purchase_totals
    assert (body["realized_total"], body["expected_total"]) == (realized, expected)


@pytest.mark.usefixtures("purchases")
def test_filter_by_farmer_keeps_the_whole_purchase_and_sums_only_that_farmer(
    client: TestClient, lettuce: Product, potato: Product
):
    body = client.get(URL, params={"farmer_public_id": str(lettuce.farmer.public_id)}).json()
    of_maria = client.get(URL, params={"farmer_public_id": str(potato.farmer.public_id)}).json()
    invalid = client.get(URL, params={"farmer_public_id": "joao"})

    assert [purchase["total"] for purchase in body["items"]] == ["5.00", "7.50", "6.50"]
    assert [len(purchase["purchase_parts"]) for purchase in body["items"]] == [2, 2, 2]
    assert (body["total"], body["realized_total"], body["expected_total"]) == (3, "10.00", "5.00")
    assert (of_maria["realized_total"], of_maria["expected_total"]) == ("4.00", "0.00")
    assert invalid.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.usefixtures("purchases")
def test_only_the_manager_reaches_the_purchases_of_the_own_building(
    client: TestClient,
    session: Session,
    building: Apartment,
    other_building: Apartment,
    lettuce: Product,
):
    resident = add_user(session, "morador@example.com")
    add_resident(session, building, resident, link_status=LinkStatus.APROVADO)
    login(client, resident)
    as_resident = client.get(URL)
    login(client, lettuce.farmer.user)
    as_farmer = client.get(URL)
    login(client, other_building.manager)
    other_manager = client.get(URL).json()
    client.cookies.clear()
    logged_out = client.get(URL)

    assert as_resident.status_code == status.HTTP_403_FORBIDDEN
    assert as_farmer.status_code == status.HTTP_403_FORBIDDEN
    assert [purchase["total"] for purchase in other_manager["items"]] == ["10.00"]
    assert (other_manager["realized_total"], other_manager["expected_total"]) == ("10.00", "0.00")
    assert logged_out.status_code == status.HTTP_401_UNAUTHORIZED
