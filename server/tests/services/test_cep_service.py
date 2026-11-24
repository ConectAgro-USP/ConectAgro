import httpx
import pytest

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.exceptions import CepNotFoundError, InvalidCepError
from src.connectors.models import Address
from src.services.cep_service import CepService
from src.services.recent_cache import RecentCache
from tests.connectors.fakes import fake_client
from tests.connectors.test_brasilapi import ACRELANDIA, NOT_FOUND, PAULISTA
from tests.helpers import FakeClock

HOUR = 60 * 60


def by_cep(request: httpx.Request) -> httpx.Response:
    body = {"01310200": PAULISTA, "69945000": ACRELANDIA}.get(request.url.path[-8:])
    if body is None:
        return httpx.Response(404, json=NOT_FOUND)
    return httpx.Response(200, json=body)


def fake_service(clock: FakeClock | None = None) -> tuple[CepService, list[httpx.Request]]:
    client, requests = fake_client(by_cep)
    clock = clock or FakeClock()
    cache = RecentCache[Address](keep_seconds=HOUR, clock=clock.read)
    return CepService(BrasilApiConnector(client), cache), requests


def test_get_address_asks_the_api_once_for_a_recent_cep():
    service, requests = fake_service()

    first = service.get_address("01310-200")
    second = service.get_address(" 01310200 ")

    assert first == second
    assert first.city == "São Paulo"
    assert len(requests) == 1


def test_get_address_remembers_each_cep_apart():
    service, requests = fake_service()

    service.get_address("01310200")
    address = service.get_address("69945000")

    assert address.city == "Acrelândia"
    assert len(requests) == 2


def test_get_address_asks_again_after_one_hour():
    clock = FakeClock()
    service, requests = fake_service(clock)
    service.get_address("01310200")

    clock.now += HOUR - 1
    service.get_address("01310200")
    clock.now += 1
    service.get_address("01310200")

    assert len(requests) == 2


def test_get_address_does_not_remember_failures():
    service, requests = fake_service()

    for _ in range(2):
        with pytest.raises(CepNotFoundError):
            service.get_address("99999999")

    assert len(requests) == 2


def test_get_address_rejects_a_malformed_cep_without_the_api():
    service, requests = fake_service()

    with pytest.raises(InvalidCepError):
        service.get_address("0131-0200")

    assert requests == []


def test_cached_address_cannot_be_changed():
    service, _ = fake_service()
    address = service.get_address("01310200")

    with pytest.raises(ValueError):
        address.coordinates.latitude = 0
