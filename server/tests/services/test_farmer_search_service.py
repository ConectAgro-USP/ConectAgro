from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import create_autospec

import pytest
from sqlmodel import Session

from src.connectors.brasilapi import BrasilApiConnector
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.farmer_search import FarmerSearchFilters
from src.models.product import Product
from src.models.purchase import Purchase, PurchasePart, PurchaseStatus
from src.models.review import Review
from src.models.user import User
from src.repository.farmer_search_repository import FarmerSearchRepository
from src.services.distance_service import DistanceService
from src.services.exceptions import ExternalServiceError
from src.services.farmer_search_service import FarmerSearchService
from tests.geo import PRACA_DA_SE, km_north

TODAY = date.today()
FUTURE = TODAY + timedelta(days=30)
BUILDING = Apartment(zip_code="01000-000")
LOCATED_BUILDING = Apartment(
    zip_code="01001-000", latitude=PRACA_DA_SE[0], longitude=PRACA_DA_SE[1]
)


def make_service(session: Session, *answers: object) -> FarmerSearchService:
    ceps = create_autospec(BrasilApiConnector, instance=True)
    ceps.get_address.side_effect = answers
    return FarmerSearchService(FarmerSearchRepository(session), DistanceService(ceps))


def create_user_and_farmer(
    session: Session,
    name: str,
    email: str,
    zip_code: str = "01001-000",
    km: float | None = None,
) -> Farmer:
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
    if km is not None:
        farmer.latitude, farmer.longitude = km_north(km)
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
    prod = Product(
        name=name,
        quantity=quantity,
        price=price,
        expiration_date=FUTURE,
        farmer_id=farmer.id,
    )
    session.add(prod)
    session.commit()
    session.refresh(prod)
    return prod


def add_review(
    session: Session,
    farmer: Farmer,
    rating: int,
    apartment: Apartment,
    purchase: Purchase,
    comment: str = "Ótimo",
) -> Review:
    review = Review(
        farmer_id=farmer.id,
        rating=rating,
        comment=comment,
        apartment_id=apartment.id,
        purchase_id=purchase.id,
    )
    session.add(review)
    session.commit()
    session.refresh(review)
    return review


def add_purchase(
    session: Session,
    farmer: Farmer,
    apartment: Apartment,
    status: PurchaseStatus = PurchaseStatus.ENTREGUE,
    expected_delivery_date: date = TODAY,
    closed_at: datetime | None = None,
) -> Purchase:
    purchase = Purchase(
        apartment_id=apartment.id,
        expected_delivery_date=expected_delivery_date,
    )
    session.add(purchase)
    session.commit()
    session.refresh(purchase)

    part = PurchasePart(
        purchase_id=purchase.id,
        farmer_id=farmer.id,
        status=status,
        closed_at=closed_at,
    )
    session.add(part)
    session.commit()
    return purchase


@pytest.fixture
def apartment(session: Session) -> Apartment:
    user = User(email="manager@example.com", name="Matheus",
                        picture_url="https://example.com/photo.jpg", 
                        cellphone = "11944644502", homephone = "1124644502")
    session.add(user)
    session.commit()
    session.refresh(user)
    apartment = Apartment(manager_id = user.id, zip_code = "01000-000",
                          building_name="Edifício Araraquara",
                          building_cnpj = "12.345.678/0001-90")
    session.add(apartment)
    session.commit()
    session.refresh(apartment)
    return apartment


@pytest.fixture
def farmer01(session: Session) -> Farmer:
    farmer = create_user_and_farmer(session, 
                                    name="Carlos da Costa Ribeiro",
                                    email="carlos@example.com")
    return farmer

@pytest.fixture
def farmer02(session: Session) -> Farmer:
    farmer = create_user_and_farmer(session, 
                                    name="Carlos da Costa Ribeiro",
                                    email="carlos@example.com")
    return farmer

def test_search_by_farmer_name_exact(session: Session):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="João Silva", email="joao@example.com")
    create_user_and_farmer(session, name="Maria Oliveira", email="maria@example.com")

    result = service.search(FarmerSearchFilters(name="João Silva"), BUILDING)

    assert result.total == 1
    assert result.items[0].public_id == farmer1.public_id
    assert result.items[0].name == "João S."


def test_search_by_farmer_name_case_insensitive_and_partial(session: Session, farmer01 : Farmer):
    service = make_service(session)
    farmer2 = create_user_and_farmer(session, name="Pedro Ribeiro", email="pedro@example.com")

    result_lower = service.search(FarmerSearchFilters(name="carlos da costa"), BUILDING)
    assert result_lower.total == 1
    assert result_lower.items[0].public_id == farmer01.public_id

    result_partial = service.search(FarmerSearchFilters(name="Ribeiro"), BUILDING)
    assert result_partial.total == 2
    assert result_partial.items[0].public_id == farmer01.public_id
    assert result_partial.items[1].public_id == farmer2.public_id


def test_search_by_farmer_name_whitespace_trimmed(session: Session):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="Carlos Mendes", email="carlos@example.com")

    result = service.search(FarmerSearchFilters(name="   Carlos Mendes   "), BUILDING)

    assert result.total == 1
    assert result.items[0].public_id == farmer1.public_id


def test_search_by_farmer_name_not_found_returns_empty(session: Session):
    service = make_service(session)
    create_user_and_farmer(session, name="João Silva", email="joao@example.com")

    result = service.search(FarmerSearchFilters(name="Inexistente"), BUILDING)

    assert result.total == 0
    assert result.items == []


def test_search_with_no_name_filter_returns_all(session: Session):
    service = make_service(session)
    create_user_and_farmer(session, name="Produtor 1", email="p1@example.com")
    create_user_and_farmer(session, name="Produtor 2", email="p2@example.com")

    result = service.search(FarmerSearchFilters(), BUILDING)

    assert result.total == 2


def test_filter_by_single_product(session: Session):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="Produtor A", email="a@example.com")
    farmer2 = create_user_and_farmer(session, name="Produtor B", email="b@example.com")
    add_product(session, farmer1, name="Tomate Italiano")
    add_product(session, farmer2, name="Alface Crespa")

    result = service.search(FarmerSearchFilters(products=["Tomate"]), BUILDING)

    assert result.total == 1
    assert result.items[0].public_id == farmer1.public_id


def test_filter_by_multiple_products_requires_all_products(session: Session):
    service = make_service(session)

    farmer1 = create_user_and_farmer(session, name="Agricultor Completo",
                                     email="completo@example.com")
    add_product(session, farmer1, name="Tomate Orgânico")
    add_product(session, farmer1, name="Alface Americana")

    farmer2 = create_user_and_farmer(session, name="Agricultor Só Tomate",
                                     email="tomate@example.com")
    add_product(session, farmer2, name="Tomate Seco")

    farmer3 = create_user_and_farmer(session, name="Agricultor Só Alface",
                                     email="alface@example.com")
    add_product(session, farmer3, name="Alface Lisa")

    result = service.search(FarmerSearchFilters(products=["Tomate", "Alface"]), BUILDING)

    assert result.total == 1
    assert result.items[0].public_id == farmer1.public_id
    assert result.items[0].name == "Agricultor C."


def test_filter_by_multiple_products_when_farmer_sells_superset(session: Session):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="Super Produtor", email="super@example.com")
    add_product(session, farmer1, name="Tomate")
    add_product(session, farmer1, name="Alface")
    add_product(session, farmer1, name="Cenoura")
    add_product(session, farmer1, name="Batata")

    filters = FarmerSearchFilters(products=["Tomate", "Alface", "Cenoura"])
    result = service.search(filters, BUILDING)

    assert result.total == 1
    assert result.items[0].public_id == farmer1.public_id


def test_filter_by_products_case_insensitive(session: Session):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="Produtor Orgânicos",
                                     email="org@example.com")
    add_product(session, farmer1, name="CENOURA AMARELA")

    result = service.search(FarmerSearchFilters(products=["cenoura"]), BUILDING)

    assert result.total == 1
    assert result.items[0].public_id == farmer1.public_id


def test_filter_by_products_no_match_returns_empty(session: Session):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="Produtor Frutas",
                                     email="frutas@example.com")
    add_product(session, farmer1, name="Maçã")

    result = service.search(FarmerSearchFilters(products=["Laranja"]), BUILDING)

    assert result.total == 0
    assert result.items == []


def test_filter_by_distance_5km(session: Session):
    farmer1 = create_user_and_farmer(session, name="Perto 3km", email="p1@example.com", km=3)
    create_user_and_farmer(session, name="Medio 8km", email="p2@example.com", km=8)
    service = make_service(session)

    result = service.search(FarmerSearchFilters(max_distance_km=5), LOCATED_BUILDING)

    assert result.total == 1
    assert result.items[0].public_id == farmer1.public_id
    assert result.items[0].distance_km == 3.0


def test_filter_by_distance_10km_and_15km(session: Session):
    farmer1 = create_user_and_farmer(session, name="Perto 4km", email="p1@example.com", km=4)
    farmer2 = create_user_and_farmer(session, name="Medio 9km", email="p2@example.com", km=9)
    farmer3 = create_user_and_farmer(session, name="Longe 14km", email="p3@example.com", km=14)
    farmer4 = create_user_and_farmer(
        session, name="Muito Longe 20km", email="p4@example.com", km=20
    )
    service = make_service(session)

    res_10km = service.search(FarmerSearchFilters(max_distance_km=10), LOCATED_BUILDING)
    assert res_10km.total == 2
    ids_10km = {item.public_id for item in res_10km.items}
    assert ids_10km == {farmer1.public_id, farmer2.public_id}

    res_15km = service.search(FarmerSearchFilters(max_distance_km=15), LOCATED_BUILDING)
    assert res_15km.total == 3
    ids_15km = {item.public_id for item in res_15km.items}
    assert ids_15km == {farmer1.public_id, farmer2.public_id, farmer3.public_id}
    assert farmer4.public_id not in ids_15km


def test_filter_by_distance_rejects_unsupported_radius():
    with pytest.raises(ValueError):
        FarmerSearchFilters(max_distance_km=8)

    with pytest.raises(ValueError):
        FarmerSearchFilters(max_distance_km=25)


def test_filter_by_distance_surfaces_distance_errors(session: Session):
    create_user_and_farmer(session, name="Produtor", email="produtor@example.com", km=1)
    service = make_service(session, ExternalServiceError("falha na BrasilAPI"))
    building = Apartment(zip_code="01001-000")

    with pytest.raises(ExternalServiceError, match="falha na BrasilAPI"):
        service.search(FarmerSearchFilters(max_distance_km=5), building)


def test_shows_average_rating_and_reviews_count(session: Session, apartment: Apartment):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="Agricultor Bem Avaliado",
                                     email="bem@example.com")

    # 2 compras com avaliações 5 e 4 (média 4.5)
    p1 = add_purchase(session, farmer1, apartment)
    p2 = add_purchase(session, farmer1, apartment)

    add_review(session, farmer1, rating=5, apartment=apartment, purchase=p1)
    add_review(session, farmer1, rating=4, apartment=apartment, purchase=p2)

    result = service.search(FarmerSearchFilters(name="Agricultor Bem Avaliado"), BUILDING)

    assert result.total == 1
    item = result.items[0]
    assert item.average_rating == 4.5
    assert item.reviews_count == 2


def test_farmer_without_reviews_has_none_or_zero(session: Session):
    service = make_service(session)
    create_user_and_farmer(session, name="Novo Agricultor", email="novo@example.com")

    result = service.search(FarmerSearchFilters(name="Novo Agricultor"), BUILDING)

    assert result.total == 1
    item = result.items[0]
    assert item.average_rating is None
    assert item.reviews_count == 0


def test_on_time_delivery_percentage_calculation(session: Session, apartment: Apartment):
    service = make_service(session)
    farmer1 = create_user_and_farmer(session, name="Produtor Entregador",
                                     email="entregas@example.com")


    add_purchase(
        session,
        farmer1,
        apartment,
        status=PurchaseStatus.ENTREGUE,
        expected_delivery_date=date(2026, 10, 10),
        closed_at=datetime(2026, 10, 9, 12, 0, tzinfo=UTC),
    )

    add_purchase(
        session,
        farmer1,
        apartment,
        status=PurchaseStatus.ENTREGUE,
        expected_delivery_date=date(2026, 10, 10),
        closed_at=datetime(2026, 10, 10, 18, 0, tzinfo=UTC),
    )
    
    add_purchase(
        session,
        farmer1,
        apartment,
        status=PurchaseStatus.ENTREGUE,
        expected_delivery_date=date(2026, 10, 10),
        closed_at=datetime(2026, 10, 12, 9, 0, tzinfo=UTC),
    )
    
    add_purchase(
        session,
        farmer1,
        apartment,
        status=PurchaseStatus.CANCELADA,
        expected_delivery_date=date(2026, 10, 10),
    )

    result = service.search(FarmerSearchFilters(name="Produtor Entregador"), BUILDING)

    assert result.total == 1
    assert result.items[0].on_time_delivery_percentage == 66.7


def test_farmer_without_delivered_purchases_has_none_percentage(session: Session):
    service = make_service(session)
    create_user_and_farmer(session, name="Sem Entregas", email="sem@example.com")

    result = service.search(FarmerSearchFilters(name="Sem Entregas"), BUILDING)

    assert result.total == 1
    assert result.items[0].on_time_delivery_percentage is None


def test_pagination_defaults_to_20_per_page(session: Session):
    service = make_service(session)

    # Cria 25 agricultores
    for i in range(25):
        create_user_and_farmer(session, name=f"Agricultor {i:02d}", email=f"ag{i}@example.com")

    # Página 1
    page1 = service.search(FarmerSearchFilters(page=1, page_size=20), BUILDING)
    assert page1.total == 25
    assert len(page1.items) == 20
    assert page1.page == 1
    assert page1.page_size == 20
    assert page1.total_pages == 2

    # Página 2
    page2 = service.search(FarmerSearchFilters(page=2, page_size=20), BUILDING)
    assert len(page2.items) == 5
    assert page2.page == 2

    # Página 3 (além do total)
    page3 = service.search(FarmerSearchFilters(page=3, page_size=20), BUILDING)
    assert len(page3.items) == 0


def test_pagination_rejects_invalid_page_or_size(session: Session):
    service = make_service(session)

    with pytest.raises(ValueError):
        service.search(FarmerSearchFilters(page=0), BUILDING)

    with pytest.raises(ValueError):
        service.search(FarmerSearchFilters(page_size=-1), BUILDING)


def test_sorts_by_rating_then_on_time_deliveries(session: Session, apartment: Apartment):
    service = make_service(session)
    unrated = create_user_and_farmer(session, name="Sem Nota", email="sem@example.com")
    low = create_user_and_farmer(session, name="Nota Baixa", email="baixa@example.com")
    late = create_user_and_farmer(session, name="Nota Alta Atrasado", email="atraso@example.com")
    on_time = create_user_and_farmer(session, name="Nota Alta Pontual", email="prazo@example.com")

    deliveries = [(low, 3, 9), (late, 5, 12), (on_time, 5, 9)]
    for farmer, rating, closing_day in deliveries:
        purchase = add_purchase(
            session,
            farmer,
            apartment,
            expected_delivery_date=date(2026, 10, 10),
            closed_at=datetime(2026, 10, closing_day, tzinfo=UTC),
        )
        add_review(session, farmer, rating=rating, apartment=apartment, purchase=purchase)

    result = service.search(FarmerSearchFilters(), BUILDING)

    assert [item.public_id for item in result.items] == [
        on_time.public_id,
        late.public_id,
        low.public_id,
        unrated.public_id,
    ]


def test_on_time_delivery_uses_the_business_day(session: Session, apartment: Apartment):
    service = make_service(session)
    farmer = create_user_and_farmer(session, name="Entrega Noturna", email="noite@example.com")
    # 01h em UTC ainda é 22h do dia 10 em Brasília, e 03h já é o dia 11
    for closing_hour in (1, 3):
        add_purchase(
            session,
            farmer,
            apartment,
            expected_delivery_date=date(2026, 10, 10),
            closed_at=datetime(2026, 10, 11, closing_hour, tzinfo=UTC),
        )

    result = service.search(FarmerSearchFilters(), BUILDING)

    assert result.items[0].on_time_delivery_percentage == 50.0


def test_rating_comes_before_distance(session: Session, apartment: Apartment):
    near = create_user_and_farmer(session, name="Perto", email="perto@example.com", km=1)
    far = create_user_and_farmer(session, name="Longe", email="longe@example.com", km=4)
    purchase = add_purchase(session, far, apartment)
    add_review(session, far, rating=5, apartment=apartment, purchase=purchase)
    service = make_service(session)

    result = service.search(FarmerSearchFilters(max_distance_km=5), LOCATED_BUILDING)

    assert [item.public_id for item in result.items] == [far.public_id, near.public_id]
    assert [item.distance_km for item in result.items] == [4.0, 1.0]
