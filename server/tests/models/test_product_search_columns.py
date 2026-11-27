from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.farmer import Farmer
from tests.helpers import add_product


def test_saving_a_product_fills_the_folded_columns(session: Session, seller: Farmer):
    product = add_product(session, seller, "Feijão  CARIOCA", description="Colheita Orgânica")

    assert product.name_search == "feijao carioca"
    assert product.description_search == "colheita organica"


def test_product_without_description_gets_an_empty_folded_description(
    session: Session, seller: Farmer
):
    product = add_product(session, seller, "Alface")

    assert product.description_search == ""


def test_changing_a_product_refreshes_the_folded_columns(session: Session, seller: Farmer):
    product = add_product(session, seller, "Alface", description="Folhas verdes")

    product.name = "Maçã Fuji"
    product.description = None
    session.add(product)
    session.commit()
    session.refresh(product)

    assert product.name_search == "maca fuji"
    assert product.description_search == ""


def test_a_product_saved_outside_the_service_shows_up_in_the_search(
    client: TestClient, session: Session, seller: Farmer, ana
):
    add_product(session, seller, "Pão de Mel", description="Receita da Vovó")

    by_name = client.get("/api/products", params={"q": "pao de mel"}).json()
    by_description = client.get("/api/products", params={"q": "vovo"}).json()

    assert [item["name"] for item in by_name["items"]] == ["Pão de Mel"]
    assert [item["name"] for item in by_description["items"]] == ["Pão de Mel"]
