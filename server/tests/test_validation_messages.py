from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from src.api.validation_messages import portuguese_message
from src.models.user import User
from tests.helpers import login

SIGNUP = {"name": "Ana Souza", "email": "ana@example.com", "password": "12345678"}


def first_error(response) -> dict:
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    return response.json()["detail"][0]


@pytest.mark.parametrize(
    "changes, field, message",
    [
        ({"password": "curta"}, "password", "Informe ao menos 8 caracteres"),
        ({"password": "x" * 129}, "password", "Informe no máximo 128 caracteres"),
        ({"name": None}, "name", "Informe um texto"),
        ({"email": "sem-arroba"}, "email", "Valor inválido"),
        ({"name": "Ana\x00Souza"}, "name", "O texto tem um caractere inválido"),
    ],
    ids=["curta", "longa", "nulo", "email", "validador-proprio"],
)
def test_sign_up_errors_come_in_portuguese_per_field(
    client: TestClient, changes: dict, field: str, message: str
):
    error = first_error(client.post("/api/auth/register", json=SIGNUP | changes))

    assert error["loc"] == ["body", field]
    assert error["msg"] == message


def test_missing_field_is_named(client: TestClient):
    error = first_error(client.post("/api/auth/register", json={"email": "ana@example.com"}))

    assert error == {"type": "missing", "loc": ["body", "name"], "msg": "Campo obrigatório"}


def test_broken_json_is_explained(client: TestClient):
    response = client.post(
        "/api/auth/register", content=b"{", headers={"content-type": "application/json"}
    )

    assert first_error(response)["msg"] == "O corpo do pedido não é um JSON válido"


@pytest.mark.usefixtures("building")
def test_unknown_field_and_bad_query_are_explained(client: TestClient, manager: User):
    login(client, manager)
    unknown = first_error(client.patch("/api/profiles/me", json={"senha": "x"}))
    bad_query = first_error(client.get("/api/apartments/me/buyers", params={"status": "X"}))

    assert unknown["msg"] == "Campo não permitido"
    assert bad_query["msg"] == "Escolha uma destas opções: 'PENDENTE', 'APROVADO' ou 'RECUSADO'"


@pytest.mark.usefixtures("farmer")
def test_status_options_show_only_the_values(client: TestClient):
    url = f"/api/purchases/{uuid4()}/parts/me/status"

    error = first_error(client.patch(url, json={"status": "EM PROGRESSO"}))

    assert error["loc"] == ["body", "status"]
    assert error["msg"] == "Escolha uma destas opções: 'ENTREGUE' ou 'CANCELADA'"


@pytest.mark.parametrize(
    "error, message",
    [
        ({"type": "string_too_short", "ctx": {"min_length": 1}}, "Informe ao menos 1 caractere"),
        ({"type": "too_long", "ctx": {"max_length": 50}}, "Envie no máximo 50 itens"),
        ({"type": "too_short", "ctx": {"min_length": 1}}, "Envie ao menos 1 item"),
        (
            {"type": "greater_than_equal", "ctx": {"ge": Decimal("0")}},
            "Informe um valor maior ou igual a 0",
        ),
        (
            {"type": "decimal_max_places", "ctx": {"decimal_places": 2}},
            "Use no máximo 2 casas decimais",
        ),
        (
            {
                "type": "literal_error",
                "ctx": {"expected": "<Cor.VERDE: 'verde'>, <Cor.AZUL: 'azul claro'> or 'roxo'"},
            },
            "Escolha uma destas opções: 'verde', 'azul claro' ou 'roxo'",
        ),
        ({"type": "uuid_parsing", "ctx": {}}, "Identificador inválido"),
        ({"type": "date_from_datetime_parsing"}, "Informe uma data válida"),
        ({"type": "tipo_que_nao_existe"}, "Valor inválido"),
        ({"type": "greater_than", "ctx": {}}, "Valor inválido"),
        ({"type": "value_error", "ctx": {"error": ValueError("CPF inválido")}}, "CPF inválido"),
        ({"type": "value_error", "ctx": {"reason": "no @"}}, "Valor inválido"),
    ],
)
def test_portuguese_message_covers_the_common_types(error: dict, message: str):
    assert portuguese_message(error) == message


def test_message_never_carries_english_from_pydantic(client: TestClient):
    response = client.post("/api/auth/register", json=SIGNUP | {"password": 123})

    assert "should" not in response.text
    assert "Input" not in response.text
