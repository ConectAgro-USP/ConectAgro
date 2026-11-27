import time
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from src.models.user import User

FUTURE = datetime.now(BUSINESS_TZ).date() + timedelta(days=30)
MAX_SECONDS = 0.500


@pytest.fixture
def ten_thousand_products(session: Session) -> None:
    farmers = []
    for index in range(100):
        user = User(name=f"Produtor {index:03d}", email=f"perf{index:03d}@example.com")
        session.add(user)
        session.flush()
        farmer = Farmer(user_id=user.id, zip_code="01001000")
        session.add(farmer)
        farmers.append(farmer)
    session.flush()

    products = []
    for index, farmer in enumerate(farmers):
        for position in range(100):
            name = "Feijão Carioca" if position == 0 else f"Produto {index}_{position}"
            product = Product(
                name=name,
                description=f"Lote {position} colhido no sítio",
                quantity=50,
                price=Decimal("4.50"),
                expiration_date=FUTURE,
                farmer_id=farmer.id,
            )
            products.append(product)
    session.add_all(products)
    session.commit()


def timed_search(client: TestClient, params: dict) -> tuple[dict, float]:
    start = time.perf_counter()
    response = client.get("/api/products", params=params)
    duration = time.perf_counter() - start
    assert response.status_code == status.HTTP_200_OK
    return response.json(), duration


@pytest.mark.usefixtures("ana", "ten_thousand_products")
@pytest.mark.parametrize(
    "params, total",
    [({}, 10_000), ({"q": "feijao"}, 100), ({"q": "sitio", "sort": "lowest_price"}, 10_000)],
    ids=["catalogo", "nome", "descricao"],
)
def test_catalog_answers_fast_with_ten_thousand_products(
    client: TestClient, params: dict, total: int
):
    body, duration = timed_search(client, params)

    assert body["total"] == total
    assert len(body["items"]) == 20
    # critério de aceite, menos de 500 ms com 10 mil produtos
    assert duration < MAX_SECONDS, (
        f"A busca de produtos levou {duration * 1000:.0f} ms com 10.000 produtos, "
        "o critério de aceite é responder em menos de 500 ms."
    )
