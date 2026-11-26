from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi import status
from haversine import haversine

from src.core.security import create_access_token
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.user import User
from tests.connectors.fakes import fake_client
from tests.helpers import add_farmer, add_resident, add_user, login

# --- Helper de Mock para BrasilAPI ---

# km de um grau de latitude, para pôr cada agricultor na distância pedida
KM_PER_DEGREE = haversine((0, 0), (1, 0))


def place_north_of_building(farmer: Farmer, meters: float) -> None:
    # a busca usa só as coordenadas salvas do agricultor
    farmer.latitude = -23.5505 + meters / 1000.0 / KM_PER_DEGREE
    farmer.longitude = -46.6333


def setup_fake_http_connectors(monkeypatch, building_cep: str):
    """Substitui a BrasilAPI por uma resposta fixa para o CEP do prédio."""
    clean_building_cep = building_cep.replace("-", "")

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)

        if "brasilapi.com.br" in url_str:
            cep_in_url = url_str.rstrip("/").split("/")[-1].replace("-", "")

            if cep_in_url == clean_building_cep:
                return httpx.Response(
                    200,
                    json={
                        "cep": cep_in_url,
                        "state": "SP",
                        "city": "São Paulo",
                        "location": {
                            "coordinates": {"latitude": "-23.5505", "longitude": "-46.6333"}
                        },
                    },
                )

            # Simula CEP inexistente / sem coordenadas
            return httpx.Response(404, json={"message": "CEP não encontrado"})

        return httpx.Response(404)

    fake_httpx, _ = fake_client(handler)
    monkeypatch.setattr("src.api.deps.http_client", fake_httpx)


def authenticate_user(client, user):
    """Autentica o usuário via Cookie de sessão conforme deps.py."""
    session_version = getattr(user, "session_version", 1)
    token = create_access_token(user.id, session_version)
    client.cookies.set("access_token", token)


def create_approved_buyer(session, user, building):
    buyer = Buyer(
        user_id=user.id,
        apartment_id=building.id,
        unit="101",
        link_status=LinkStatus.APROVADO,
    )
    session.add(buyer)


# --- Suíte de Testes ---

def test_list_farmers_ordering_by_distance_ascending(client, ana, building, session, monkeypatch):
    """
    Critério de Aceite Coberto:
    - Cadastra dois agricultores associados a usuários diferentes com distâncias distintas.
    - Garante que a lista retornada venha ordenada por distance_km crescente.
    """
    create_approved_buyer(session, ana, building)

    # Agricultor 1 (Ana) - CEP 05508-020
    farmer_1 = Farmer(
        user_id=ana.id, zip_code="05508-020", latitude=-23.62245, longitude=-46.6333
    )
    session.add(farmer_1)

    # Agricultor 2 (Carlos) - CEP 01311-000
    carlos = User(name="Carlos Eduardo", email="carlos@example.com")
    session.add(carlos)
    session.flush()

    farmer_2 = Farmer(
        user_id=carlos.id, zip_code="01311-000", latitude=-23.52802, longitude=-46.6333
    )
    session.add(farmer_2)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(monkeypatch, building_cep=building.zip_code)

    response = client.get("/api/farmers?max_distance_km=10")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()["items"]
    assert len(data) == 2

    # Carlos (2.5 km) deve vir antes de Ana (8.0 km)
    assert data[0]["name"] == "Carlos E."
    assert data[0]["distance_km"] < data[1]["distance_km"]


def test_list_farmers_counts_only_available_products(client, ana, building, session, monkeypatch):
    """
    Critério de Aceite Coberto:
    - Verifica se a contagem 'available_products_count' considera APENAS produtos disponíveis.
    """
    create_approved_buyer(session, ana, building)
    farmer = Farmer(user_id=ana.id, zip_code="05508-020")
    place_north_of_building(farmer, 3500.0)
    session.add(farmer)
    session.flush()

    today = datetime.now(UTC)
    expired_date = today - timedelta(days=2)
    future_date = today + timedelta(days=10)

    # 1. Produto disponível (estoque > 0 e validade no futuro)
    prod1 = Product(
        farmer_id=farmer.id,
        name="Tomate Orgânico",
        quantity=10,
        price=5.50,
        expiration_date=future_date,
    )
    # 2. Produto disponível (estoque > 0 e validade no futuro)
    prod2 = Product(
        farmer_id=farmer.id,
        name="Alface Crespa",
        quantity=15,
        price=3.00,
        expiration_date=future_date,
    )
    # 3. Produto indisponível por estoque zerado
    prod3 = Product(
        farmer_id=farmer.id,
        name="Morango Sem Estoque",
        quantity=0,
        price=10.00,
        expiration_date=future_date,
    )
    # 4. Produto indisponível por estar vencido
    prod4 = Product(
        farmer_id=farmer.id,
        name="Cenoura Vencida",
        quantity=20,
        price=4.00,
        expiration_date=expired_date,
    )

    session.add_all([prod1, prod2, prod3, prod4])
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(monkeypatch, building_cep=building.zip_code)

    response = client.get("/api/farmers?max_distance_km=10")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()["items"]
    assert len(data) == 1

    # Deve contar apenas os 2 produtos válidos e com estoque (prod1 e prod2)
    assert data[0]["available_products_count"] == 2


def test_list_farmers_returns_expected_fields_and_values(
        client, ana, building, session, monkeypatch
    ):
    create_approved_buyer(session, ana, building)
    farmer = Farmer(user_id=ana.id, zip_code="05508-020")
    place_north_of_building(farmer, 3500.0)
    session.add(farmer)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(monkeypatch, building_cep=building.zip_code)

    response = client.get("/api/farmers?max_distance_km=10")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()["items"]
    assert len(data) == 1

    farmer_result = data[0]
    expected_fields = {
        "public_id",
        "name",
        "farm_name",
        "zip_code",
        "distance_km",
        "available_products_count",
    }
    assert expected_fields.issubset(farmer_result)
    assert farmer_result["public_id"] == str(farmer.public_id)
    assert farmer_result["zip_code"] == "05508-020"
    assert farmer_result["distance_km"] == pytest.approx(3.5)
    assert farmer_result["available_products_count"] == 0


def test_list_farmers_excludes_farmer_outside_radius(client, ana, building, session, monkeypatch):
    create_approved_buyer(session, ana, building)
    farmer = Farmer(user_id=ana.id, zip_code="05508-020")
    place_north_of_building(farmer, 6000.0)
    session.add(farmer)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(monkeypatch, building_cep=building.zip_code)

    response = client.get("/api/farmers?max_distance_km=5")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["items"] == []


@pytest.mark.parametrize("valid_distance", [5, 10, 15])
def test_list_farmers_accepts_supported_max_distance_values(
    client, ana, building, session, valid_distance, monkeypatch
):
    create_approved_buyer(session, ana, building)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(monkeypatch, building_cep=building.zip_code)

    response = client.get(f"/api/farmers?max_distance_km={valid_distance}")

    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json()["items"], list)


@pytest.mark.parametrize("invalid_distance", [0, 1, 4, 6, 9, 11, 14, 16, 20, -5])
def test_list_farmers_rejects_unsupported_max_distance_values(
    client, ana, building, session, invalid_distance
):
    create_approved_buyer(session, ana, building)
    session.commit()

    authenticate_user(client, ana)

    response = client.get(f"/api/farmers?max_distance_km={invalid_distance}")

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_manager_lists_farmers_near_the_building(client, manager, building, session, monkeypatch):
    farmer = add_farmer(session, add_user(session, "carlos@example.com", name="Carlos Souza"))
    place_north_of_building(farmer, 0.0)
    session.commit()
    login(client, manager)
    setup_fake_http_connectors(monkeypatch, building_cep=building.zip_code)

    response = client.get("/api/farmers?max_distance_km=5")

    assert response.status_code == status.HTTP_200_OK
    assert [item["name"] for item in response.json()["items"]] == ["Carlos S."]


def test_list_farmers_requires_login(client):
    response = client.get("/api/farmers?max_distance_km=5")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_user_without_building_cannot_list_farmers(client, ana, session):
    add_farmer(session, ana)

    response = client.get("/api/farmers?max_distance_km=5")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Acesso permitido apenas para moradores e síndicos"}


@pytest.mark.parametrize("link_status", [LinkStatus.PENDENTE, LinkStatus.RECUSADO])
def test_resident_not_approved_cannot_list_farmers(client, ana, building, session, link_status):
    add_resident(session, building, ana, link_status=link_status)

    response = client.get("/api/farmers?max_distance_km=5")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_list_farmers_hides_email_saved_as_farmer_name(
    client, manager, building, session, monkeypatch
):
    email = "carlos@example.com"
    farmer = add_farmer(session, add_user(session, email, name=email))
    place_north_of_building(farmer, 0.0)
    session.commit()
    login(client, manager)
    setup_fake_http_connectors(monkeypatch, building_cep=building.zip_code)

    response = client.get("/api/farmers?max_distance_km=5")

    assert [item["name"] for item in response.json()["items"]] == [""]
    assert email not in response.text


def test_list_farmers_fails_when_external_service_is_down(
    client, ana, building, session, monkeypatch
):
    add_resident(session, building, ana, link_status=LinkStatus.APROVADO)
    add_farmer(session, ana)
    fake_httpx, _ = fake_client(httpx.Response(500))
    monkeypatch.setattr("src.api.deps.http_client", fake_httpx)

    response = client.get("/api/farmers?max_distance_km=15")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
