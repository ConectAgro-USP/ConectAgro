import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.user import User
from tests.connectors.test_brasilapi import ACRELANDIA, PAULISTA
from tests.connectors.test_cnpja import BANCO_DO_BRASIL
from tests.geo import PAULISTA_POINT
from tests.profiles import APARTMENT, FARMER, answer_cep, answer_cnpj

# coordenadas que a BrasilAPI dá na resposta ACRELANDIA
ACRELANDIA_POINT = (-10.07387, -67.055)
PROFILES = [
    ("/api/profiles/farmer", FARMER, Farmer),
    ("/api/profiles/apartment", APARTMENT, Apartment),
]


@pytest.fixture(autouse=True)
def fake_apis() -> None:
    answer_cep(httpx.Response(200, json=PAULISTA))
    answer_cnpj(httpx.Response(200, json=BANCO_DO_BRASIL))


def saved_point(session: Session, model: type[Farmer | Apartment]) -> tuple:
    profile = session.exec(select(model)).one()
    return profile.latitude, profile.longitude


@pytest.mark.parametrize("path, payload, model", PROFILES, ids=["agricultor", "sindico"])
def test_new_profile_saves_the_coordinates_of_the_cep(
    client: TestClient, session: Session, ana: User, path: str, payload: dict, model: type
):
    response = client.post(path, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    assert saved_point(session, model) == PAULISTA_POINT


@pytest.mark.parametrize("path, payload, model", PROFILES, ids=["agricultor", "sindico"])
def test_new_cep_replaces_the_saved_coordinates(
    client: TestClient, session: Session, ana: User, path: str, payload: dict, model: type
):
    client.post(path, json=payload)
    answer_cep(httpx.Response(200, json=ACRELANDIA))

    response = client.patch("/api/profiles/me", json={"zip_code": "69945-000"})

    assert response.status_code == status.HTTP_200_OK
    assert saved_point(session, model) == ACRELANDIA_POINT
