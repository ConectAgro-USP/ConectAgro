import time
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.api.deps import get_distance_service
from src.main import app
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.purchase import Purchase, PurchaseStatus
from src.models.review import Review
from src.models.user import User
from src.services.distance_service import DistanceService

TODAY = date.today()
FUTURE = TODAY + timedelta(days=60)


def create_farmer(session: Session, name: str, email: str, zip_code: str = "01001-000") -> Farmer:
    user = User(
        name=name,
        email=email,
        picture_url=f"https://example.com/{name.lower().replace(' ', '_')}.jpg",
        cellphone="11957249062",
        homephone="1140028922",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    farmer = Farmer(user_id=user.id, zip_code=zip_code)
    session.add(farmer)
    session.commit()
    session.refresh(farmer)
    return farmer


def add_product(
    session: Session,
    farmer: Farmer,
    name: str,
    quantity: int = 10,
    price: Decimal = Decimal("5.00"),
) -> Product:
    product = Product(
        name=name,
        quantity=quantity,
        price=price,
        expiration_date=FUTURE,
        farmer_id=farmer.id,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@pytest.fixture
def apartment(session: Session) -> Apartment:
    user = User(name="Gestor Prédio", email="gestor@predio.com")
    session.add(user)
    session.commit()
    session.refresh(user)

    apartment = Apartment(
        manager_id=user.id,
        zip_code="01001-000",
        building_name="Residencial Jardins",
        building_cnpj="12.345.678/0001-90",
    )
    session.add(apartment)
    session.commit()
    session.refresh(apartment)
    return apartment


def test_api_search_by_farmer_name(client: TestClient, session: Session):
    f1 = create_farmer(session, name="Sebastião Pereira", email="sebastiao@example.com")
    create_farmer(session, name="Luciana Santos", email="luciana@example.com")

    response = client.get("/api/farmers", params={"name": "Sebastião"})

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Sebastião Pereira"
    assert data["items"][0]["public_id"] == str(f1.public_id)


def test_api_search_by_farmer_name_case_insensitive(client: TestClient, session: Session):
    create_farmer(session, name="Mariana Lima", email="mariana@example.com")

    response = client.get("/api/farmers", params={"name": "mariana"})

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Mariana Lima"


def test_api_search_by_farmer_name_not_found(client: TestClient, session: Session):
    create_farmer(session, name="Carlos Silva", email="carlos@example.com")

    response = client.get("/api/farmers", params={"name": "NomeQueNaoExiste"})

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_api_filter_by_multiple_products(client: TestClient, session: Session):
    farmer1 = create_farmer(session, name="Horta Completa", email="horta@example.com")
    farmer2 = create_farmer(session, name="Só Morango", email="morango@example.com")
    farmer3 = create_farmer(session, name="Só Banana", email="banana@example.com")

    add_product(session, farmer1, name="Morango Doce")
    add_product(session, farmer1, name="Banana Prata")

    add_product(session, farmer2, name="Morango Silvestre")
    add_product(session, farmer3, name="Banana Nanica")


    response = client.get("/api/farmers", params={"products": ["morango", "banana"]})

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Horta Completa"


def test_api_filter_by_distance_allowed_values(client: TestClient, session: Session):
    mock_distance = MagicMock(spec=DistanceService)
    create_farmer(session, name="Perto 4km", email="perto@example.com", zip_code="01001-000")
    create_farmer(session, name="Longe 12km", email="longe@example.com", zip_code="02002-000")

    distances = {"01001-000": 4000.0, "02002-000": 12000.0}
    mock_distance.between_ceps.side_effect = lambda orig, dest: MagicMock(
        distance_m=distances[dest]
    )

    app.dependency_overrides[get_distance_service] = lambda: mock_distance

    res_5km = client.get(
        "/api/farmers", params={"origin_cep": "01000-000", "max_distance_km": 5}
    )
    assert res_5km.status_code == status.HTTP_200_OK
    data_5km = res_5km.json()
    assert data_5km["total"] == 1
    assert data_5km["items"][0]["name"] == "Perto 4km"

    res_15km = client.get(
        "/api/farmers", params={"origin_cep": "01000-000", "max_distance_km": 15}
    )
    assert res_15km.status_code == status.HTTP_200_OK
    data_15km = res_15km.json()
    assert data_15km["total"] == 2


def test_api_filter_by_distance_rejects_invalid_km(client: TestClient):
    response = client.get(
        "/api/farmers", params={"origin_cep": "01000-000", "max_distance_km": 20}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    response_negative = client.get(
        "/api/farmers", params={"origin_cep": "01000-000", "max_distance_km": -5}
    )
    assert response_negative.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_api_filter_by_distance_without_origin_cep_returns_422(client: TestClient):
    response = client.get("/api/farmers", params={"max_distance_km": 10})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY



def test_api_result_fields_schema(client: TestClient, session: Session, apartment: Apartment):
    farmer = create_farmer(session, name="Agricultor Avaliado", email="avaliado@example.com")

    product1 = Purchase(
        farmer_id=farmer.id,
        apartment_id=apartment.id,
        status=PurchaseStatus.ENTREGUE,
        expected_delivery_date=date(2026, 10, 10),
        closed_at=datetime(2026, 10, 8, tzinfo=UTC),
    )

    product2 = Purchase(
        farmer_id=farmer.id,
        apartment_id=apartment.id,
        status=PurchaseStatus.ENTREGUE,
        expected_delivery_date=date(2026, 10, 10),
        closed_at=datetime(2026, 10, 15, tzinfo=UTC),
    )
    session.add_all([product1, product2])
    session.commit()
    session.refresh(product1)
    session.refresh(product2)

    review1 = Review(farmer_id=farmer.id, apartment_id=apartment.id, 
                     purchase_id=product1.id, rating=5)
    review2 = Review(farmer_id=farmer.id, apartment_id=apartment.id, 
                     purchase_id=product2.id, rating=3)
    session.add_all([review1, review2])
    session.commit()

    response = client.get("/api/farmers", params={"name": "Agricultor Avaliado"})
    assert response.status_code == status.HTTP_200_OK

    item = response.json()["items"][0]
    assert item["name"] == "Agricultor Avaliado"
    assert item["average_rating"] == 4.0
    assert item["reviews_count"] == 2
    assert item["on_time_delivery_percentage"] == 50.0
    assert "public_id" in item
    assert "zip_code" in item



def test_api_pagination_20_per_page(client: TestClient, session: Session):
    for i in range(25):
        create_farmer(session, name=f"Produtor Rural {i:02d}", email=f"produtor{i}@example.com")


    res_p1 = client.get("/api/farmers", params={"page": 1})
    assert res_p1.status_code == status.HTTP_200_OK
    data_p1 = res_p1.json()
    assert data_p1["total"] == 25
    assert len(data_p1["items"]) == 20
    assert data_p1["page"] == 1
    assert data_p1["page_size"] == 20
    assert data_p1["total_pages"] == 2

    res_p2 = client.get("/api/farmers", params={"page": 2})
    assert res_p2.status_code == status.HTTP_200_OK
    data_p2 = res_p2.json()
    assert len(data_p2["items"]) == 5
    assert data_p2["page"] == 2


    res_p3 = client.get("/api/farmers", params={"page": 3})
    assert res_p3.status_code == status.HTTP_200_OK
    assert len(res_p3.json()["items"]) == 0


def test_api_pagination_rejects_invalid_page(client: TestClient):
    response = client.get("/api/farmers", params={"page": 0})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY



def test_api_performance_with_10k_products(client: TestClient, session: Session):
   
    farmers: list[Farmer] = []
    for i in range(100):
        user = User(
            name=f"Produtor Desempenho {i:03d}",
            email=f"perf{i:03d}@example.com",
            cellphone="11957249062",
            homephone="1140028922",
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        farmer = Farmer(user_id=user.id, zip_code="01001-000")
        session.add(farmer)
        session.commit()
        session.refresh(farmer)
        farmers.append(farmer)

    products: list[Product] = []
    for i, farmer in enumerate(farmers):
        for j in range(100):
            pname = "Tomate Cereja" if j == 0 else f"Produto {i}_{j}"
            products.append(
                Product(
                    name=pname,
                    quantity=50,
                    price=Decimal("4.50"),
                    expiration_date=FUTURE,
                    farmer_id=farmer.id,
                )
            )

    session.add_all(products)
    session.commit()

    start_time = time.perf_counter()
    response = client.get(
        "/api/farmers",
        params={"name": "Produtor Desempenho", "products": ["Tomate Cereja"], "page": 1},
    )
    duration_s = time.perf_counter() - start_time

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 100
    assert len(data["items"]) == 20

    # Critério de aceite: menos de 500 ms (0.5 s)
    assert duration_s < 0.500, (
        f"A API demorou {duration_s * 1000:.2f} ms com 10.000 produtos cadastrados, "
        "o critério de aceite exige resposta em menos de 500 ms."
    )
