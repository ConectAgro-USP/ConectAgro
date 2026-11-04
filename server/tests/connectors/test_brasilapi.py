import httpx
import pytest
from pydantic import ValidationError

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.exceptions import CepNotFoundError, ExternalServiceError, InvalidCepError
from src.connectors.models import Address, Coordinates
from tests.connectors.fakes import fake_client

# resposta real da BrasilAPI em 2026-10-12
PAULISTA = {
    "cep": "01310200",
    "state": "SP",
    "city": "São Paulo",
    "neighborhood": "Bela Vista",
    "street": "Avenida Paulista",
    "service": "open-cep",
    "ibge": {"city": "3550308", "state": "35"},
    "timezoneName": "America/Sao_Paulo",
    "location": {
        "type": "Point",
        "coordinates": {"longitude": "-46.63611", "latitude": "-23.5475"},
    },
}
# resposta real da BrasilAPI em 2026-10-13 para CEP geral de município, reduzida aos campos lidos
ACRELANDIA = {
    "cep": "69945000",
    "state": "AC",
    "city": "Acrelândia",
    "neighborhood": None,
    "street": None,
    "location": {"coordinates": {"longitude": "-67.055", "latitude": "-10.07387"}},
}
NOT_FOUND = {"name": "CepPromiseError", "type": "service_error"}
INVALID = {"name": "CepPromiseError", "type": "validation_error"}


def fake_brasilapi(response, **options) -> tuple[BrasilApiConnector, list[httpx.Request]]:
    client, requests = fake_client(response)
    return BrasilApiConnector(client, **options), requests


def test_get_address_uses_the_default_url_and_returns_the_address():
    connector, requests = fake_brasilapi(httpx.Response(200, json=PAULISTA))

    address = connector.get_address("01310200")

    assert address == Address(
        cep="01310200",
        state="SP",
        city="São Paulo",
        neighborhood="Bela Vista",
        street="Avenida Paulista",
        coordinates=Coordinates(latitude=-23.5475, longitude=-46.63611),
    )
    assert str(requests[0].url) == "https://brasilapi.com.br/api/cep/v2/01310200"
    assert requests[0].extensions["timeout"] == httpx.Timeout(5.0).as_dict()


def test_get_address_uses_the_configured_url_and_timeout():
    connector, requests = fake_brasilapi(
        httpx.Response(200, json=PAULISTA), base_url="https://cep.interno/api", timeout=2.0
    )

    connector.get_address("01310200")

    assert str(requests[0].url) == "https://cep.interno/api/cep/v2/01310200"
    assert requests[0].extensions["timeout"] == httpx.Timeout(2.0).as_dict()


def test_get_address_accepts_cep_without_street():
    connector, _ = fake_brasilapi(httpx.Response(200, json=ACRELANDIA))

    address = connector.get_address("69945-000")

    assert (address.street, address.neighborhood) == (None, None)
    assert address.coordinates == Coordinates(latitude=-10.07387, longitude=-67.055)


@pytest.mark.parametrize("cep", ["01310-200", " 01310200 "])
def test_get_address_accepts_formatted_cep(cep: str):
    connector, requests = fake_brasilapi(httpx.Response(200, json=PAULISTA))

    connector.get_address(cep)

    assert requests[0].url.path == "/api/cep/v2/01310200"


@pytest.mark.parametrize(
    "cep", ["", "1310200", "0131020a", "01310.200", "013102000", "０１３１０２００"]
)
def test_get_address_rejects_malformed_cep_without_calling_the_api(cep: str):
    connector, requests = fake_brasilapi(httpx.Response(200, json=PAULISTA))

    with pytest.raises(InvalidCepError):
        connector.get_address(cep)

    assert requests == []


@pytest.mark.parametrize(
    "response, error",
    [
        (httpx.Response(400, json=INVALID), InvalidCepError),
        (httpx.Response(404, json=NOT_FOUND), CepNotFoundError),
        (httpx.Response(200, json=[]), ExternalServiceError),
        (httpx.Response(200, json={**PAULISTA, "city": None}), ExternalServiceError),
        (httpx.Response(203, json=PAULISTA), ExternalServiceError),
        (httpx.Response(200, json={**PAULISTA, "cep": "０１３１０２００"}), ExternalServiceError),
        (httpx.Response(200, json={**PAULISTA, "cep": "013102000"}), ExternalServiceError),
        (httpx.ConnectError("sem rede"), ExternalServiceError),
    ],
    ids=[
        "400",
        "404",
        "lista",
        "sem-cidade",
        "203-com-endereco",
        "cep-nao-ascii",
        "cep-com-9-digitos",
        "rede",
    ],
)
def test_get_address_maps_failures(response, error):
    connector, _ = fake_brasilapi(response)

    with pytest.raises(error):
        connector.get_address("01310200")


def test_get_address_keeps_the_validation_error_as_cause():
    connector, _ = fake_brasilapi(httpx.Response(200, json={**PAULISTA, "state": None}))

    with pytest.raises(ExternalServiceError) as caught:
        connector.get_address("01310200")

    assert isinstance(caught.value.__cause__, ValidationError)


@pytest.mark.parametrize(
    "location",
    [
        None,
        {"type": "Point", "coordinates": None},
        {"type": "Point", "coordinates": {"longitude": "-46.6"}},
        {"type": "Point", "coordinates": {"latitude": "-23.5"}},
        {"type": "Point", "coordinates": {"latitude": "", "longitude": "-46.6"}},
        {"type": "Point", "coordinates": {"latitude": "-23.5", "longitude": ""}},
    ],
    ids=[
        "location-nulo",
        "coordinates-nulo",
        "sem-latitude",
        "sem-longitude",
        "latitude-vazia",
        "longitude-vazia",
    ],
)
def test_get_address_returns_no_coordinates_when_missing_or_empty(location):
    connector, _ = fake_brasilapi(httpx.Response(200, json={**PAULISTA, "location": location}))

    assert connector.get_address("01310200").coordinates is None


@pytest.mark.parametrize(
    "coordinates",
    [
        {"latitude": "abc", "longitude": "-46.6"},
        {"latitude": "-95", "longitude": "-46.6"},
        {"latitude": "95", "longitude": "-46.6"},
        {"latitude": "-23.5", "longitude": "-200"},
        {"latitude": "-23.5", "longitude": "200"},
        [-46.63611, -23.5475],
    ],
    ids=[
        "nao-numerica",
        "latitude-abaixo-da-faixa",
        "latitude-acima-da-faixa",
        "longitude-abaixo-da-faixa",
        "longitude-acima-da-faixa",
        "lista-geojson",
    ],
)
def test_get_address_rejects_invalid_coordinates(coordinates):
    payload = {**PAULISTA, "location": {"type": "Point", "coordinates": coordinates}}
    connector, _ = fake_brasilapi(httpx.Response(200, json=payload))

    with pytest.raises(ExternalServiceError):
        connector.get_address("01310200")
