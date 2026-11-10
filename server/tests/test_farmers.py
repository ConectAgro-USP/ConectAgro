from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi import status

from src.core.security import create_access_token
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.user import User
from tests.connectors.fakes import fake_client
from tests.helpers import add_farmer, add_resident, add_user, login

# --- Helper de Mock para BrasilAPI e OSRM ---

def setup_fake_http_connectors(
    monkeypatch,
    building_cep: str,
    farmer_ceps_distances: dict[str, float],
):
    """
    Substitui BrasilAPI e OSRM por respostas determinísticas.
    `farmer_ceps_distances` é um dicionário {cep_agricultor: distancia_em_metros}.
    """
    clean_building_cep = building_cep.replace("-", "")
    clean_farmer_ceps = {cep.replace("-", ""): dist for cep, dist in farmer_ceps_distances.items()}

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)

        # Intercepção BrasilAPI (Coordenadas de CEP)
        if "brasilapi.com.br" in url_str:
            cep_in_url = url_str.rstrip("/").split("/")[-1].replace("-", "")

            if cep_in_url == clean_building_cep or cep_in_url in clean_farmer_ceps:
                # Gera uma latitude diferente por CEP para diferenciar no OSRM se necessário
                lat_offset = sum(ord(c) for c in cep_in_url) % 100 / 1000.0
                return httpx.Response(
                    200,
                    json={
                        "cep": cep_in_url,
                        "state": "SP",
                        "city": "São Paulo",
                        "location": {
                            "coordinates": {
                                "latitude": str(-23.5505 - lat_offset),
                                "longitude": str(-46.6333 - lat_offset),
                            }
                        },
                    },
                )

            # Simula CEP inexistente / sem coordenadas
            return httpx.Response(404, json={"message": "CEP não encontrado"})

        # Intercepção OSRM (Cálculo de Distância + Duração)
        if "router.project-osrm.org" in url_str:
            distance_m = 3500.0
            for _cep_clean, dist in clean_farmer_ceps.items():
                distance_m = dist
                break

            return httpx.Response(
                200,
                json={
                    "code": "Ok",
                    "routes": [{"distance": distance_m, "duration": 300.0}],
                },
            )

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
    farmer_1 = Farmer(user_id=ana.id, zip_code="05508-020")
    session.add(farmer_1)

    # Agricultor 2 (Carlos) - CEP 01311-000
    carlos = User(name="Carlos Eduardo", email="carlos@example.com")
    session.add(carlos)
    session.flush()

    farmer_2 = Farmer(user_id=carlos.id, zip_code="01311-000")
    session.add(farmer_2)
    session.commit()

    authenticate_user(client, ana)

    # Coordenadas distintas para identificar qual agricultor está sendo consultado no OSRM
    # CEP Ana (05508-020) -> lat -23.5600
    # CEP Carlos (01311-000) -> lat -23.5100
    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "brasilapi.com.br" in url_str:
            cep_in_url = url_str.rstrip("/").split("/")[-1].replace("-", "")
            lat = "-23.5505"
            if cep_in_url == "05508020":
                lat = "-23.5600"
            elif cep_in_url == "01311000":
                lat = "-23.5100"

            return httpx.Response(
                200,
                json={
                    "cep": cep_in_url,
                    "state": "SP",
                    "city": "São Paulo",
                    "location": {"coordinates": {"latitude": lat, "longitude": "-46.6333"}},
                },
            )
        if "router.project-osrm.org" in url_str:
            dist = 8000.0 if "-23.56" in url_str else 2500.0
            payload = {"code": "Ok", "routes": [{"distance": dist, "duration": 300.0}]}
            return httpx.Response(200, json=payload)
        return httpx.Response(404)

    fake_httpx, _ = fake_client(handler)
    monkeypatch.setattr("src.api.deps.http_client", fake_httpx)

    response = client.get("/api/farmers?max_distance_km=10")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
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
    session.add(farmer)
    session.flush()

    today = datetime.now(UTC)
    expired_date = today - timedelta(days=1)
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
    setup_fake_http_connectors(
        monkeypatch,
        building_cep=building.zip_code,
        farmer_ceps_distances={"05508-020": 3500.0},
    )

    response = client.get("/api/farmers?max_distance_km=10")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 1

    # Deve contar apenas os 2 produtos válidos e com estoque (prod1 e prod2)
    assert data[0]["available_products_count"] == 2


def test_list_farmers_returns_expected_fields_and_values(
        client, ana, building, session, monkeypatch
    ):
    create_approved_buyer(session, ana, building)
    farmer = Farmer(user_id=ana.id, zip_code="05508-020")
    session.add(farmer)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(
        monkeypatch,
        building_cep=building.zip_code,
        farmer_ceps_distances={"05508-020": 3500.0},
    )

    response = client.get("/api/farmers?max_distance_km=10")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
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
    session.add(farmer)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(
        monkeypatch,
        building_cep=building.zip_code,
        farmer_ceps_distances={"05508-020": 6000.0},
    )

    response = client.get("/api/farmers?max_distance_km=5")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_list_farmers_ignores_farmer_with_cep_without_coordinates(
        client, ana, building, session, monkeypatch
    ):
    create_approved_buyer(session, ana, building)
    farmer = Farmer(user_id=ana.id, zip_code="00000-000")
    session.add(farmer)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(
        monkeypatch,
        building_cep=building.zip_code,
        farmer_ceps_distances={},
    )

    response = client.get("/api/farmers?max_distance_km=15")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


@pytest.mark.parametrize("valid_distance", [5, 10, 15])
def test_list_farmers_accepts_supported_max_distance_values(
    client, ana, building, session, valid_distance, monkeypatch
):
    create_approved_buyer(session, ana, building)
    session.commit()

    authenticate_user(client, ana)
    setup_fake_http_connectors(
        monkeypatch,
        building_cep=building.zip_code,
        farmer_ceps_distances={},
    )

    response = client.get(f"/api/farmers?max_distance_km={valid_distance}")

    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)


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
    login(client, manager)
    setup_fake_http_connectors(
        monkeypatch,
        building_cep=building.zip_code,
        farmer_ceps_distances={farmer.zip_code: 3500.0},
    )

    response = client.get("/api/farmers?max_distance_km=5")

    assert response.status_code == status.HTTP_200_OK
    assert [item["name"] for item in response.json()] == ["Carlos S."]


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
    login(client, manager)
    setup_fake_http_connectors(
        monkeypatch,
        building_cep=building.zip_code,
        farmer_ceps_distances={farmer.zip_code: 3500.0},
    )

    response = client.get("/api/farmers?max_distance_km=5")

    assert [item["name"] for item in response.json()] == [""]
    assert email not in response.text


def test_list_farmers_ignores_farmer_with_invalid_cep(client, ana, building, session, monkeypatch):
    add_resident(session, building, ana, link_status=LinkStatus.APROVADO)
    session.add(Farmer(user_id=ana.id, zip_code="CEP"))
    session.commit()
    setup_fake_http_connectors(
        monkeypatch, building_cep=building.zip_code, farmer_ceps_distances={}
    )

    response = client.get("/api/farmers?max_distance_km=15")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_list_farmers_fails_when_external_service_is_down(
    client, ana, building, session, monkeypatch
):
    add_resident(session, building, ana, link_status=LinkStatus.APROVADO)
    add_farmer(session, ana)
    fake_httpx, _ = fake_client(httpx.Response(500))
    monkeypatch.setattr("src.api.deps.http_client", fake_httpx)

    response = client.get("/api/farmers?max_distance_km=15")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
