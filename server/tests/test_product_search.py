from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import Purchase
from src.models.review import Review
from tests.helpers import add_building, add_farmer, add_user

# a busca exige login, então todos os testes rodam com a Ana logada
pytestmark = pytest.mark.usefixtures("ana")


def add_product(
    session: Session,
    farmer: Farmer,
    name: str,
    description: str | None = None,
    *,
    quantity: int = 5,
    price: Decimal = Decimal("3.00"),
    days_until_expiration: int = 10,
) -> Product:
    product = Product(
        name=name,
        description=description,
        quantity=quantity,
        price=price,
        expiration_date=datetime.now(BUSINESS_TZ).date()
        + timedelta(days=days_until_expiration),
        farmer_id=farmer.id,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def add_farmer_with_name(session: Session, email: str) -> Farmer:
    return add_farmer(session, add_user(session, email))


def test_search_matches_product_name_only_without_fuzzy_matching(
    client: TestClient, session: Session
):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    add_product(
        session,
        farmer,
        "Tomate Italiano",
        "Tomates orgânicos frescos, colhidos hoje.",
    )

    name_match = client.get("/api/products", params={"q": "TOMATE"})
    fuzzy_name = client.get("/api/products", params={"q": "TOMATTE"})
    description_match = client.get("/api/products", params={"q": "orgânicos"})

    assert name_match.status_code == status.HTTP_200_OK
    assert [item["name"] for item in name_match.json()["items"]] == ["Tomate Italiano"]
    assert name_match.json()["items"][0]["public_id"]
    assert name_match.json()["items"][0]["farmer_public_id"] == str(farmer.public_id)
    assert fuzzy_name.json()["items"] == []
    assert description_match.json()["items"] == []


def test_search_filters_unavailable_products_and_paginates(
    client: TestClient, session: Session
):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    for index in range(22):
        add_product(session, farmer, f"Produto {index:02}", "Lote disponível")
    add_product(session, farmer, "Produto sem estoque", "Lote disponível", quantity=0)
    add_product(
        session,
        farmer,
        "Produto vencido",
        "Lote disponível",
        days_until_expiration=-1,
    )

    first_page = client.get("/api/products", params={"q": "produto", "page": 1})
    second_page = client.get("/api/products", params={"q": "produto", "page": 2})

    assert first_page.status_code == status.HTTP_200_OK
    assert len(first_page.json()["items"]) == 20
    assert first_page.json()["page"] == 1
    assert first_page.json()["page_size"] == 20
    assert first_page.json()["total"] == 22
    assert first_page.json()["total_pages"] == 2
    assert len(second_page.json()["items"]) == 2
    assert second_page.json()["page"] == 2


def test_search_applies_expiration_and_minimum_quantity_filters(
    client: TestClient, session: Session
):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    today = datetime.now(BUSINESS_TZ).date()
    add_product(session, farmer, "Pouco estoque", quantity=2)
    wanted = add_product(
        session,
        farmer,
        "Estoque suficiente",
        quantity=10,
        days_until_expiration=20,
    )
    add_product(session, farmer, "Vence antes", days_until_expiration=5)

    response = client.get(
        "/api/products",
        params={"min_quantity": 5, "expiration_from": today + timedelta(days=10)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert [item["public_id"] for item in response.json()["items"]] == [
        str(wanted.public_id)
    ]


def test_default_sort_prefers_name_prefix_before_farmer_rating(
    client: TestClient, session: Session
):
    low_rated_farmer = add_farmer_with_name(session, "low-rated@example.com")
    high_rated_farmer = add_farmer_with_name(session, "high-rated@example.com")
    unrated_farmer = add_farmer_with_name(session, "unrated@example.com")
    unrated_prefix = add_product(
        session, unrated_farmer, "Tomate italiano", "Outro produto."
    )
    name_prefix = add_product(
        session, low_rated_farmer, "Tomate maduro", "Tomate fresco."
    )
    name_contains = add_product(
        session, high_rated_farmer, "Pimentão com tomate", "Outro produto."
    )

    apartment = add_building(session, add_user(session, "manager@example.com"))
    purchase = Purchase(
        apartment_id=apartment.id,
        expected_delivery_date=date.today() + timedelta(days=1),
    )
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    session.add_all(
        [
            Review(
                rating=2,
                purchase_id=purchase.id,
                farmer_id=low_rated_farmer.id,
                apartment_id=apartment.id,
            ),
            Review(
                rating=5,
                purchase_id=purchase.id,
                farmer_id=high_rated_farmer.id,
                apartment_id=apartment.id,
            ),
        ]
    )
    session.commit()

    default_response = client.get("/api/products")
    relevance_response = client.get("/api/products", params={"q": "tomate"})
    rating_response = client.get(
        "/api/products",
        params={"q": "tomate", "sort": "highest_rating"},
    )

    assert [item["public_id"] for item in relevance_response.json()["items"]] == [
        str(name_prefix.public_id),
        str(unrated_prefix.public_id),
        str(name_contains.public_id),
    ]
    assert [item["public_id"] for item in rating_response.json()["items"]] == [
        str(name_contains.public_id),
        str(name_prefix.public_id),
        str(unrated_prefix.public_id),
    ]
    assert default_response.json()["items"] == rating_response.json()["items"]


def test_alternative_sorts_and_invalid_filters(client: TestClient, session: Session):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    cheap = add_product(session, farmer, "Maçã", price=Decimal("2.00"))
    expensive = add_product(
        session,
        farmer,
        "Pera",
        price=Decimal("4.00"),
        days_until_expiration=20,
    )

    by_price = client.get("/api/products", params={"sort": "lowest_price"})
    by_expiration = client.get("/api/products", params={"sort": "latest_expiration"})
    invalid = client.get("/api/products", params={"page": 0, "min_quantity": 0})

    assert [item["public_id"] for item in by_price.json()["items"]] == [
        str(cheap.public_id),
        str(expensive.public_id),
    ]
    assert [item["public_id"] for item in by_expiration.json()["items"]] == [
        str(expensive.public_id),
        str(cheap.public_id),
    ]
    assert invalid.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_search_treats_wildcards_as_plain_text(client: TestClient, session: Session):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    add_product(session, farmer, "Suco 100% natural")
    add_product(session, farmer, "Alface")

    percent = client.get("/api/products", params={"q": "%"})
    underscore = client.get("/api/products", params={"q": "_"})

    assert [item["name"] for item in percent.json()["items"]] == ["Suco 100% natural"]
    assert underscore.json()["items"] == []
