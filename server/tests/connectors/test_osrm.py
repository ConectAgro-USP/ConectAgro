import httpx
import pytest
from pydantic import ValidationError

from src.connectors.exceptions import ExternalServiceError, RouteNotFoundError
from src.connectors.models import Coordinates, Route
from src.connectors.osrm import OsrmConnector
from tests.connectors.fakes import fake_client

PRACA_DA_SE = Coordinates(latitude=-23.550520, longitude=-46.633309)
AV_DO_ESTADO = Coordinates(latitude=-23.533773, longitude=-46.625290)
# resposta real do OSRM entre os dois pontos em 2026-10-12, reduzida aos campos lidos
ROUTE_OK = {"code": "Ok", "routes": [{"distance": 3570.3, "duration": 395.2}]}
# o json do Python lê 1e999 como infinito
INFINITE_DISTANCE = b'{"code": "Ok", "routes": [{"distance": 1e999, "duration": 1}]}'
INFINITE_DURATION = b'{"code": "Ok", "routes": [{"distance": 1, "duration": 1e999}]}'


def fake_osrm(response, **options) -> tuple[OsrmConnector, list[httpx.Request]]:
    client, requests = fake_client(response)
    return OsrmConnector(client, **options), requests


def test_get_route_uses_the_default_url_and_returns_the_route():
    connector, requests = fake_osrm(httpx.Response(200, json=ROUTE_OK))

    route = connector.get_route(PRACA_DA_SE, AV_DO_ESTADO)

    assert route == Route(distance_m=3570.3, duration_s=395.2)
    assert str(requests[0].url) == (
        "https://router.project-osrm.org/route/v1/driving/"
        "-46.633309,-23.550520;-46.625290,-23.533773?overview=false"
    )
    assert requests[0].extensions["timeout"] == httpx.Timeout(5.0).as_dict()


def test_get_route_uses_the_configured_url_and_timeout():
    connector, requests = fake_osrm(
        httpx.Response(200, json=ROUTE_OK), base_url="https://osrm.interno/v1", timeout=2.0
    )

    connector.get_route(PRACA_DA_SE, AV_DO_ESTADO)

    assert str(requests[0].url).startswith("https://osrm.interno/v1/route/v1/driving/")
    assert requests[0].extensions["timeout"] == httpx.Timeout(2.0).as_dict()


def test_get_route_writes_small_coordinates_without_exponent():
    connector, requests = fake_osrm(httpx.Response(200, json=ROUTE_OK))

    connector.get_route(Coordinates(latitude=0.00001, longitude=-50.0), AV_DO_ESTADO)

    assert requests[0].url.path.startswith("/route/v1/driving/-50.000000,0.000010;")


@pytest.mark.parametrize("code", ["NoRoute", "NoSegment"])
def test_get_route_raises_route_not_found(code: str):
    connector, _ = fake_osrm(httpx.Response(400, json={"code": code, "message": "sem rota"}))

    with pytest.raises(RouteNotFoundError):
        connector.get_route(PRACA_DA_SE, AV_DO_ESTADO)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={**ROUTE_OK, "code": "InvalidValue"}),
        httpx.Response(200, json={"code": "Ok", "routes": []}),
        httpx.Response(200, json={"code": "Ok"}),
        httpx.Response(200, json={"code": "Ok", "routes": None}),
        httpx.Response(200, json={"code": "Ok", "routes": [{"distance": -1, "duration": 1}]}),
        httpx.Response(200, json={"code": "Ok", "routes": [{"distance": 1, "duration": -1}]}),
        httpx.Response(200, content=INFINITE_DISTANCE),
        httpx.Response(200, content=INFINITE_DURATION),
        httpx.Response(203, json=ROUTE_OK),
        httpx.Response(200, json=["Ok"]),
        httpx.ConnectError("sem rede"),
    ],
    ids=[
        "200-com-code-de-erro",
        "sem-rotas",
        "sem-campo-routes",
        "routes-nulo",
        "distancia-negativa",
        "duracao-negativa",
        "distancia-infinita",
        "duracao-infinita",
        "203-com-rota",
        "lista",
        "rede",
    ],
)
def test_get_route_maps_failures(response):
    connector, _ = fake_osrm(response)

    with pytest.raises(ExternalServiceError):
        connector.get_route(PRACA_DA_SE, AV_DO_ESTADO)


def test_get_route_keeps_the_validation_error_as_cause():
    connector, _ = fake_osrm(
        httpx.Response(200, json={"code": "Ok", "routes": [{"distance": None, "duration": 1}]})
    )

    with pytest.raises(ExternalServiceError) as caught:
        connector.get_route(PRACA_DA_SE, AV_DO_ESTADO)

    assert isinstance(caught.value.__cause__, ValidationError)
