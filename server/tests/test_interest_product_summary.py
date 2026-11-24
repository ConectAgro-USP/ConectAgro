from collections.abc import Iterator
from contextlib import contextmanager
from decimal import Decimal

from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session

from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.product import ProductUnit
from tests.helpers import add_farmer, add_interest, add_product, add_user, login

URL = "/api/interests/me"


@contextmanager
def counted_queries(session: Session) -> Iterator[list[str]]:
    queries: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    engine = session.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield queries
    finally:
        event.remove(engine, "before_cursor_execute", record)


def my_interests(client: TestClient, resident: Buyer) -> list[dict]:
    login(client, resident.user)
    response = client.get(URL)
    assert response.status_code == status.HTTP_200_OK
    return response.json()["items"]


def test_interest_brings_what_the_resident_sees_of_the_product(
    client: TestClient, session: Session, resident: Buyer, joao: Farmer
):
    joao.farm_name = "Sítio Boa Vista"
    product = add_product(
        session,
        joao,
        name="Ovos",
        price=Decimal("12.00"),
        unit=ProductUnit.DUZIA,
        quantity=8,
        picture_url="https://example.com/ovos.jpg",
    )
    add_interest(session, resident, product, quantity=2)

    [interest] = my_interests(client, resident)

    assert interest["product"] == {
        "picture_url": "https://example.com/ovos.jpg",
        "price": "12.00",
        "unit": "duzia",
        "quantity": 8,
        "expiration_date": product.expiration_date.isoformat(),
        "is_available": True,
        "farmer": {
            "public_id": str(joao.public_id),
            "short_name": "João L.",
            "farm_name": "Sítio Boa Vista",
        },
    }


def test_paused_product_still_brings_its_summary(
    client: TestClient, session: Session, resident: Buyer, joao: Farmer
):
    product = add_product(session, joao, is_available=False)
    add_interest(session, resident, product)

    [interest] = my_interests(client, resident)

    assert interest["product"]["is_available"] is False
    assert interest["product_status"] == "Indisponível"


def test_deleted_product_brings_no_summary(
    client: TestClient, session: Session, resident: Buyer, joao: Farmer
):
    product = add_product(session, joao, name="Alface")
    add_interest(session, resident, product)
    login(client, joao.user)
    deleted = client.delete(f"/api/products/{product.public_id}")
    assert deleted.status_code == status.HTTP_204_NO_CONTENT

    [interest] = my_interests(client, resident)

    assert interest["product"] is None
    assert interest["product_public_id"] is None


def test_created_interest_brings_the_summary(
    client: TestClient, session: Session, resident: Buyer, joao: Farmer
):
    product = add_product(session, joao)
    login(client, resident.user)

    body = {"product_public_id": str(product.public_id), "quantity": 1}
    created = client.post("/api/interests", json=body).json()

    assert created["product"]["farmer"]["short_name"] == "João L."
    assert created["product"]["price"] == "2.50"


def test_summary_costs_the_same_queries_for_one_or_many_farmers(
    client: TestClient, session: Session, resident: Buyer, joao: Farmer
):
    add_interest(session, resident, add_product(session, joao, name="Alface"))
    with counted_queries(session) as one:
        my_interests(client, resident)

    for index in range(2):
        user = add_user(session, f"agricultor{index}@example.com", name="Rui Alves")
        add_interest(session, resident, add_product(session, add_farmer(session, user)))
    with counted_queries(session) as three:
        interests = my_interests(client, resident)

    assert len(interests) == 3
    assert len(three) == len(one)
