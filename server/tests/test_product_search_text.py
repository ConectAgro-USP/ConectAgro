from datetime import datetime, timedelta

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ
from tests.catalog import add_farmer_with_name, add_product


def new_product(client: TestClient, name: str, description: str | None = None) -> dict:
    expiration = datetime.now(BUSINESS_TZ).date() + timedelta(days=10)
    payload = {
        "name": name,
        "description": description,
        "quantity": 5,
        "price": "3.00",
        "expiration_date": expiration.isoformat(),
    }
    response = client.post("/api/products", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    return response.json()


def names_found(client: TestClient, query: str) -> list[str]:
    response = client.get("/api/products", params={"q": query})
    assert response.status_code == status.HTTP_200_OK
    return [item["name"] for item in response.json()["items"]]


def test_search_ignores_accents_and_case_in_the_name(client: TestClient, farmer: Farmer):
    new_product(client, "Feijão Carioca")

    assert names_found(client, "feijao") == ["Feijão Carioca"]
    assert names_found(client, "FEIJÃO carioca") == ["Feijão Carioca"]
    assert names_found(client, "  feijão   CARIOCA ") == ["Feijão Carioca"]


def test_search_finds_a_word_that_only_the_description_has(client: TestClient, farmer: Farmer):
    new_product(client, "Alface", "Colhida hoje, cultivo Orgânico")
    new_product(client, "Rúcula")

    assert names_found(client, "organico") == ["Alface"]
    assert names_found(client, "colhida hoje") == ["Alface"]


def test_search_follows_the_new_name_after_an_update(client: TestClient, farmer: Farmer):
    product = new_product(client, "Alface", "Folhas verdes")

    response = client.patch(
        f"/api/products/{product['public_id']}",
        json={"name": "Maçã Fuji", "description": "Doce e crocante"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert names_found(client, "maca") == ["Maçã Fuji"]
    assert names_found(client, "crocante") == ["Maçã Fuji"]
    assert names_found(client, "alface") == []
    assert names_found(client, "folhas") == []


def test_search_without_description_still_matches_by_name(client: TestClient, farmer: Farmer):
    product = new_product(client, "Couve", "Couve manteiga")

    client.patch(f"/api/products/{product['public_id']}", json={"description": None})

    assert names_found(client, "couve") == ["Couve"]
    assert names_found(client, "manteiga") == []


def test_name_match_comes_before_a_match_only_in_the_description(
    client: TestClient, session: Session, ana
):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    # o acerto só na descrição foi cadastrado antes, e vem por último
    add_product(session, farmer, "Arroz", "Combina com feijão")
    add_product(session, farmer, "Caldo de feijão")
    add_product(session, farmer, "Feijão preto")

    assert names_found(client, "feijao") == ["Feijão preto", "Caldo de feijão", "Arroz"]


def test_query_made_only_of_accents_lists_every_product(client: TestClient, session: Session, ana):
    farmer = add_farmer_with_name(session, "farmer@example.com")
    add_product(session, farmer, "Alface")
    add_product(session, farmer, "Rúcula")

    # o acento solto vira texto vazio, e a busca fica sem filtro
    assert sorted(names_found(client, "\u0301")) == ["Alface", "Rúcula"]
