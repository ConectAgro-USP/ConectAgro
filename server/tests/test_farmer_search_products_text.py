import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.user import User
from tests.helpers import add_farmer, add_product, add_user, login


@pytest.fixture(autouse=True)
def logged_manager(client: TestClient, manager: User, building: Apartment) -> None:
    login(client, manager)


@pytest.fixture
def carlos(session: Session) -> Farmer:
    return add_farmer(session, add_user(session, "carlos@example.com", name="Carlos Silva"))


def farm_names(client: TestClient, *products: str) -> list[str]:
    response = client.get("/api/farmers", params={"products": list(products)})
    return [item["name"] for item in response.json()["items"]]


@pytest.mark.parametrize("term", ["feijao", "FEIJÃO", "Feijão", "  feijão  carioca "])
def test_products_filter_ignores_accents_case_and_spaces(
    client: TestClient, session: Session, carlos: Farmer, term: str
):
    add_product(session, carlos, "Feijão Carioca")

    assert farm_names(client, term) == ["Carlos S."]


def test_products_filter_finds_an_accented_term_in_an_unaccented_name(
    client: TestClient, session: Session, carlos: Farmer
):
    add_product(session, carlos, "Oleo de coco")

    assert farm_names(client, "Óleo") == ["Carlos S."]


def test_products_filter_still_needs_every_term(
    client: TestClient, session: Session, carlos: Farmer
):
    add_product(session, carlos, "Feijão Carioca")

    assert farm_names(client, "feijao", "maçã") == []


def test_products_filter_treats_wildcards_as_plain_text(
    client: TestClient, session: Session, carlos: Farmer
):
    add_product(session, carlos, "Feijão Carioca")

    assert farm_names(client, "%") == []
    assert farm_names(client, "feij_o") == []
