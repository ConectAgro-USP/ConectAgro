import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.user import User
from tests.helpers import add_building, add_user

NAME_REQUIRED = "Informe o CNPJ ou o nome do prédio, apenas um dos dois"


def add_named_building(session: Session, email: str, name: str) -> Apartment:
    return add_building(session, add_user(session, email, name="Bruno Lima Costa"), name=name)


@pytest.mark.parametrize("name", ["araraquara", "ARARAQUARA", "  edificio   ARAR "])
@pytest.mark.usefixtures("ana")
def test_name_search_ignores_accents_case_and_spaces(
    client: TestClient, building: Apartment, name: str
):
    response = client.get("/api/apartments", params={"name": name})

    assert response.status_code == status.HTTP_200_OK
    assert [found["public_id"] for found in response.json()] == [str(building.public_id)]


@pytest.mark.usefixtures("ana")
def test_name_search_returns_name_address_and_cep(
    client: TestClient, session: Session, building: Apartment
):
    building.address = "Rua Quatro, 251 - Vila Verde, Rio Grande da Serra"
    session.commit()

    response = client.get("/api/apartments", params={"name": "Araraquara"})

    assert response.json() == [
        {
            "public_id": str(building.public_id),
            "building_name": "Edifício Araraquara",
            "building_cnpj": "00000000000191",
            "zip_code": "01310200",
            "address": "Rua Quatro, 251 - Vila Verde, Rio Grande da Serra",
            "manager_short_name": "Ana S.",
        }
    ]


@pytest.mark.usefixtures("ana")
def test_name_search_finds_the_middle_of_the_name_in_order(client: TestClient, session: Session):
    add_named_building(session, "b@example.com", "Residencial Jardim das Flores")
    add_named_building(session, "a@example.com", "Condomínio Jardim Paulista")
    add_named_building(session, "c@example.com", "Edifício Bauru")

    response = client.get("/api/apartments", params={"name": "jardim"})

    names = [found["building_name"] for found in response.json()]
    assert names == ["Condomínio Jardim Paulista", "Residencial Jardim das Flores"]


@pytest.mark.usefixtures("ana")
def test_name_search_returns_at_most_20_buildings(client: TestClient, session: Session):
    for number in range(21):
        add_named_building(session, f"s{number}@example.com", f"Torre {number:02d}")

    response = client.get("/api/apartments", params={"name": "torre"})

    names = [found["building_name"] for found in response.json()]
    assert names == [f"Torre {number:02d}" for number in range(20)]


@pytest.mark.usefixtures("ana")
def test_name_search_treats_like_wildcards_as_text(client: TestClient, session: Session):
    add_named_building(session, "a@example.com", "Edifício 100% Verde")
    add_named_building(session, "b@example.com", "Edifício 1000 Verde")

    response = client.get("/api/apartments", params={"name": "100%"})

    assert [found["building_name"] for found in response.json()] == ["Edifício 100% Verde"]


@pytest.mark.usefixtures("ana")
def test_name_search_follows_a_renamed_building(
    client: TestClient, session: Session, building: Apartment
):
    building.building_name = "Edifício São João"
    session.commit()

    assert client.get("/api/apartments", params={"name": "araraquara"}).json() == []
    found = client.get("/api/apartments", params={"name": "sao joao"}).json()
    assert [item["public_id"] for item in found] == [str(building.public_id)]


@pytest.mark.parametrize("name", ["ed", "  é  ", "a b", "!!!!"])
@pytest.mark.usefixtures("ana", "building")
def test_name_search_needs_three_letters(client: TestClient, name: str):
    response = client.get("/api/apartments", params={"name": name})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json() == {"detail": "Informe ao menos 3 letras do nome do prédio"}


@pytest.mark.parametrize(
    "params",
    [{}, {"cnpj": "00.000.000/0001-91", "name": "Araraquara"}],
    ids=["nenhum", "os-dois"],
)
@pytest.mark.usefixtures("ana", "building")
def test_search_needs_exactly_one_of_cnpj_and_name(client: TestClient, params: dict):
    response = client.get("/api/apartments", params=params)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json() == {"detail": NAME_REQUIRED}


@pytest.mark.parametrize("name", ["a" * 151, "Ara\x00raquara"], ids=["longo", "nulo"])
@pytest.mark.usefixtures("ana")
def test_name_search_rejects_long_or_null_names(client: TestClient, name: str):
    response = client.get("/api/apartments", params={"name": name})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_name_search_requires_login(client: TestClient, manager: User):
    response = client.get("/api/apartments", params={"name": "Araraquara"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
