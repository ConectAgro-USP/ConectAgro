import httpx
import pytest
from pydantic import ValidationError

from src.connectors.cnpja import CnpjaConnector
from src.connectors.exceptions import (
    CnpjNotFoundError,
    ExternalServiceError,
    InvalidCnpjError,
    RateLimitedError,
)
from src.connectors.models import Company
from tests.connectors.fakes import fake_client

# respostas reais da CNPJá em outubro de 2026, reduzidas aos campos lidos
BANCO_DO_BRASIL = {
    "company": {"name": "BANCO DO BRASIL SA"},
    "status": {"text": "Ativa"},
    "address": {"zip": "70040912"},
}
INVALID = {"code": 400, "message": "request validation failed"}
NOT_FOUND = {"code": 404, "message": "tax id not registered at revenue service"}
RATE_LIMITED = {"code": 429, "message": "rate limit exceeded"}


def fake_cnpja(response, **options) -> tuple[CnpjaConnector, list[httpx.Request]]:
    client, requests = fake_client(response)
    return CnpjaConnector(client, **options), requests


def test_get_company_uses_the_default_url_and_returns_the_company():
    connector, requests = fake_cnpja(httpx.Response(200, json=BANCO_DO_BRASIL))

    company = connector.get_company("00000000000191")

    assert company == Company(
        name="BANCO DO BRASIL SA", registration_status="Ativa", cep="70040912"
    )
    assert str(requests[0].url) == "https://open.cnpja.com/office/00000000000191"
    assert requests[0].extensions["timeout"] == httpx.Timeout(5.0).as_dict()


def test_get_company_uses_the_configured_url_and_timeout():
    connector, requests = fake_cnpja(
        httpx.Response(200, json=BANCO_DO_BRASIL), base_url="https://cnpj.interno", timeout=2.0
    )

    connector.get_company("00000000000191")

    assert str(requests[0].url) == "https://cnpj.interno/office/00000000000191"
    assert requests[0].extensions["timeout"] == httpx.Timeout(2.0).as_dict()


def test_get_company_accepts_alphanumeric_tax_id():
    connector, requests = fake_cnpja(httpx.Response(200, json=BANCO_DO_BRASIL))

    connector.get_company("00000000E08G12")

    assert requests[0].url.path == "/office/00000000E08G12"


@pytest.mark.parametrize(
    "tax_id",
    [
        "",
        "../saude",
        "00000000000191?x=1",
        "00000000e08g12",
        "0000000000019",
        "000000000001911",
        "0000000000019A",
        "０００００００００００１９１",
    ],
    ids=[
        "vazio",
        "caminho",
        "query",
        "minusculo",
        "13-caracteres",
        "15-caracteres",
        "letra-no-verificador",
        "digitos-nao-ascii",
    ],
)
def test_get_company_rejects_malformed_tax_id_without_calling_the_api(tax_id: str):
    connector, requests = fake_cnpja(httpx.Response(200, json=BANCO_DO_BRASIL))

    with pytest.raises(InvalidCnpjError):
        connector.get_company(tax_id)

    assert requests == []


@pytest.mark.parametrize(
    "response, error",
    [
        (httpx.Response(400, json=INVALID), InvalidCnpjError),
        (httpx.Response(404, json=NOT_FOUND), CnpjNotFoundError),
        (httpx.Response(429, json=RATE_LIMITED), RateLimitedError),
        (httpx.Response(200, json=[]), ExternalServiceError),
        (httpx.Response(200, json={**BANCO_DO_BRASIL, "company": None}), ExternalServiceError),
        (httpx.Response(200, json={**BANCO_DO_BRASIL, "status": {}}), ExternalServiceError),
        (
            httpx.Response(200, json={**BANCO_DO_BRASIL, "address": {"zip": "７００４０９１２"}}),
            ExternalServiceError,
        ),
        (httpx.Response(203, json=BANCO_DO_BRASIL), ExternalServiceError),
        (httpx.ConnectError("sem rede"), ExternalServiceError),
    ],
    ids=[
        "400",
        "404",
        "429",
        "lista",
        "sem-empresa",
        "sem-situacao",
        "cep-nao-ascii",
        "203-com-empresa",
        "rede",
    ],
)
def test_get_company_maps_failures(response, error):
    connector, _ = fake_cnpja(response)

    with pytest.raises(error):
        connector.get_company("00000000000191")


@pytest.mark.parametrize("zip_code", [None, ""], ids=["cep-nulo", "cep-vazio"])
def test_get_company_returns_no_cep_when_zip_is_null_or_empty(zip_code: str | None):
    payload = {**BANCO_DO_BRASIL, "address": {"zip": zip_code}}
    connector, _ = fake_cnpja(httpx.Response(200, json=payload))

    assert connector.get_company("00000000000191").cep is None


def test_get_company_keeps_the_validation_error_as_cause():
    payload = {**BANCO_DO_BRASIL, "address": {"zip": "7004091"}}
    connector, _ = fake_cnpja(httpx.Response(200, json=payload))

    with pytest.raises(ExternalServiceError) as caught:
        connector.get_company("00000000000191")

    assert isinstance(caught.value.__cause__, ValidationError)
