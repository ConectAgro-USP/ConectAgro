import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.user import User
from tests.helpers import add_farmer, add_user, login


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


def add_named_farmer(session: Session, email: str, name: str, farm_name: str | None = None) -> None:
    farmer = add_farmer(session, add_user(session, email, name=name))
    farmer.farm_name = farm_name
    session.commit()


def found(client: TestClient, name: str) -> list[str]:
    response = client.get("/api/farmers", params={"name": name})
    return [item["name"] for item in response.json()["items"]]


@pytest.mark.parametrize("query", ["sebastiao", "SEBASTIÃO", "Sebastião", "  sebastiao  "])
def test_name_search_ignores_accents_and_case(client: TestClient, session: Session, query: str):
    add_named_farmer(session, "sebastiao@example.com", "Sebastião Pereira")
    add_named_farmer(session, "luciana@example.com", "Luciana Santos")

    assert found(client, query) == ["Sebastião P."]


def test_name_search_folds_the_saved_name_too(client: TestClient, session: Session):
    add_named_farmer(session, "joao@example.com", "JOÃO DA CONCEIÇÃO")

    assert found(client, "joão da conceicao") == ["JOÃO C."]


@pytest.mark.parametrize("query", ["sitio boa vista", "Boa Vísta", "SÍTIO"])
def test_name_search_matches_the_farm_name(client: TestClient, session: Session, query: str):
    add_named_farmer(session, "carlos@example.com", "Carlos Silva", "Sítio Boa Vista")
    add_named_farmer(session, "ana@example.com", "Ana Lima", "Chácara Primavera")

    assert found(client, query) == ["Carlos S."]


def test_name_search_matches_farmers_without_farm_name(client: TestClient, session: Session):
    add_named_farmer(session, "carlos@example.com", "Carlos Silva")

    assert found(client, "carlos") == ["Carlos S."]
    assert found(client, "sitio") == []


def test_name_search_never_matches_the_email_saved_as_name(client: TestClient, session: Session):
    add_named_farmer(session, "carlos@example.com", "carlos@example.com", "Sítio do Carlos")

    assert found(client, "example") == []
    by_farm = client.get("/api/farmers", params={"name": "sitio do carlos"})
    assert [item["name"] for item in by_farm.json()["items"]] == [""]
    assert "carlos@example.com" not in by_farm.text


def test_name_search_combines_with_the_products_filter(client: TestClient, session: Session):
    add_named_farmer(session, "carlos@example.com", "Carlos Silva", "Sítio Boa Vista")

    response = client.get("/api/farmers", params={"name": "boa vista", "products": ["morango"]})

    assert response.json()["total"] == 0
