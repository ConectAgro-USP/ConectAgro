from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.purchase import PurchaseStatus
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_purchase, add_user, login

URL = "/api/farmers/me/sales"


@pytest.fixture
def joao(client: TestClient, session: Session) -> Farmer:
    farmer = add_farmer(session, add_user(session, "joao@example.com"))
    login(client, farmer.user)
    return farmer


@pytest.fixture
def lettuce(session: Session, joao: Farmer) -> Product:
    return add_product(session, joao, name="Alface")


@pytest.fixture
def sales(session: Session, building: Apartment, other_building: Apartment, lettuce: Product):
    # a venda mais nova é criada primeiro, para a ordem vir da data e não do id
    add_purchase(
        session,
        building,
        (lettuce, 3),
        status=PurchaseStatus.CANCELADA,
        created_at=datetime(2026, 3, 10, 12, tzinfo=UTC),
    )
    add_purchase(
        session,
        building,
        (lettuce, 1),
        status=PurchaseStatus.ENTREGUE,
        created_at=datetime(2026, 1, 10, 12, tzinfo=UTC),
    )
    # 2 horas em UTC ainda é o dia 10 em Brasília
    add_purchase(
        session, other_building, (lettuce, 2), created_at=datetime(2026, 2, 11, 2, tzinfo=UTC)
    )


def test_farmer_sees_only_own_part_with_items_and_total(
    client: TestClient, session: Session, building: Apartment, lettuce: Product
):
    kale = add_product(session, lettuce.farmer, name="Couve", price=Decimal("4.00"))
    maria = add_farmer(session, add_user(session, "maria@example.com"))
    potato = add_product(session, maria, name="Batata")
    purchase = add_purchase(session, building, (lettuce, 4), (kale, 1), (potato, 3))
    # só a parte do João fecha, a compra segue em progresso pela parte da Maria
    part = purchase.purchase_parts[0]
    part.status, part.closed_at = PurchaseStatus.ENTREGUE, datetime(2026, 1, 2, 12, tzinfo=UTC)
    session.commit()

    response = client.get(URL)

    body = response.json()
    assert response.status_code == status.HTTP_200_OK
    assert (body["total"], body["page"], body["page_size"], body["total_pages"]) == (1, 1, 20, 1)
    assert (body["realized_total"], body["expected_total"]) == ("14.00", "0.00")
    [sale] = body["items"]
    assert sale.pop("purchased_at").startswith(purchase.created_at.date().isoformat())
    assert sale.pop("closed_at").startswith("2026-01-02")
    assert sale == {
        "purchase_public_id": str(purchase.public_id),
        "apartment_public_id": str(building.public_id),
        "building_name": "Edifício Araraquara",
        "status": "ENTREGUE",
        "total": "14.00",
        "purchase_products": [
            {
                "product_public_id": str(lettuce.public_id),
                "product_name": "Alface",
                "quantity": 4,
                "unit_price": "2.50",
                "subtotal": "10.00",
            },
            {
                "product_public_id": str(kale.public_id),
                "product_name": "Couve",
                "quantity": 1,
                "unit_price": "4.00",
                "subtotal": "4.00",
            },
        ],
    }


@pytest.mark.parametrize(
    "params, sale_totals, realized, expected",
    [
        ({}, ["7.50", "5.00", "2.50"], "2.50", "5.00"),
        ({"status": "ENTREGUE"}, ["2.50"], "2.50", "5.00"),
        ({"date_from": "2026-02-10"}, ["7.50", "5.00"], "0.00", "5.00"),
        ({"date_from": "2026-02-11"}, ["7.50"], "0.00", "0.00"),
        ({"date_to": "2026-02-10"}, ["5.00", "2.50"], "2.50", "5.00"),
        ({"date_from": "2026-01-11", "date_to": "2026-02-09"}, [], "0.00", "0.00"),
    ],
    ids=["tudo", "entregue", "desde", "depois", "ate", "vazio"],
)
@pytest.mark.usefixtures("sales")
def test_sales_filters_change_the_list_and_status_keeps_the_totals(
    client: TestClient, params: dict, sale_totals: list[str], realized: str, expected: str
):
    body = client.get(URL, params=params).json()

    assert [sale["total"] for sale in body["items"]] == sale_totals
    assert (body["realized_total"], body["expected_total"]) == (realized, expected)


@pytest.mark.usefixtures("sales")
def test_sales_filter_by_building_and_pagination(client: TestClient, other_building: Apartment):
    by_building = client.get(URL, params={"apartment_public_id": str(other_building.public_id)})
    second_page = client.get(URL, params={"page": 2, "page_size": 1}).json()

    assert [sale["building_name"] for sale in by_building.json()["items"]] == ["Edifício Bauru"]
    # os totais somam só as vendas para o prédio do filtro
    assert (by_building.json()["total"], by_building.json()["realized_total"]) == (1, "0.00")
    assert by_building.json()["expected_total"] == "5.00"
    assert [sale["total"] for sale in second_page["items"]] == ["5.00"]
    assert (second_page["total"], second_page["total_pages"]) == (3, 3)


@pytest.mark.parametrize(
    "params",
    [{"page": 0}, {"page_size": 101}, {"status": "ABERTA"}, {"date_to": "9999-12-31"}],
    ids=["pagina-zero", "pagina-grande", "status-desconhecido", "ultimo-dia"],
)
def test_sales_reject_invalid_filters(client: TestClient, joao: Farmer, params: dict):
    response = client.get(URL, params=params)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.usefixtures("sales")
def test_only_farmers_reach_their_own_sales(client: TestClient, session: Session, manager: User):
    pedro = add_farmer(session, add_user(session, "pedro@example.com"))
    login(client, pedro.user)
    other_farmer = client.get(URL).json()
    login(client, manager)
    as_manager = client.get(URL)
    client.cookies.clear()
    logged_out = client.get(URL)

    assert (other_farmer["items"], other_farmer["total"]) == ([], 0)
    assert (other_farmer["realized_total"], other_farmer["expected_total"]) == ("0.00", "0.00")
    assert as_manager.status_code == status.HTTP_403_FORBIDDEN
    assert logged_out.status_code == status.HTTP_401_UNAUTHORIZED
