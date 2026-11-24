import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from src.models.user import User
from tests.connectors.test_brasilapi import PAULISTA
from tests.connectors.test_cnpja import BANCO_DO_BRASIL
from tests.test_profiles import APARTMENT, FARMER, answer_cep, answer_cnpj

WITHOUT_COORDINATES = {**PAULISTA, "location": None}
WHAT_TO_DO = (
    "Não conseguimos localizar este CEP no mapa. Informe um CEP próximo, como o de uma "
    "rua vizinha, ou o CEP geral da sua cidade, que termina em 000"
)


@pytest.fixture(autouse=True)
def answers() -> None:
    answer_cep(httpx.Response(200, json=WITHOUT_COORDINATES))
    answer_cnpj(httpx.Response(200, json=BANCO_DO_BRASIL))


@pytest.mark.parametrize(
    "path, payload",
    [("/api/profiles/farmer", FARMER), ("/api/profiles/apartment", APARTMENT)],
    ids=["agricultor", "sindico"],
)
@pytest.mark.usefixtures("ana")
def test_sign_up_tells_what_to_do_with_a_cep_without_coordinates(
    client: TestClient, path: str, payload: dict
):
    response = client.post(path, json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json() == {"detail": WHAT_TO_DO}


def test_profile_update_tells_the_same(client: TestClient, ana: User):
    answer_cep(httpx.Response(200, json=PAULISTA))
    client.post("/api/profiles/farmer", json=FARMER)
    answer_cep(httpx.Response(200, json={**WITHOUT_COORDINATES, "cep": "69945000"}))

    response = client.patch("/api/profiles/me", json={"zip_code": "69945-000"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json() == {"detail": WHAT_TO_DO}
