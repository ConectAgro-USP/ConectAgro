import time

import httpx
import pytest

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.cnpja import CnpjaConnector
from src.connectors.exceptions import CnpjNotFoundError, ExternalServiceError, RateLimitedError
from src.connectors.http import RETRY_DELAY, get_json
from tests.connectors.fakes import fake_client
from tests.connectors.test_brasilapi import PAULISTA
from tests.connectors.test_cnpja import BANCO_DO_BRASIL, NOT_FOUND, RATE_LIMITED

URL = "https://api.exemplo/recurso"


@pytest.fixture(autouse=True)
def waits(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    slept: list[float] = []
    monkeypatch.setattr(time, "sleep", slept.append)
    return slept


def answers(*responses):
    pending = list(responses)

    def handler(request: httpx.Request) -> httpx.Response:
        response = pending.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    return handler


@pytest.mark.parametrize(
    "failure",
    [
        httpx.Response(500, json={}),
        httpx.Response(503, content=b"fora do ar"),
        httpx.ReadTimeout("demorou"),
        httpx.ConnectTimeout("demorou"),
    ],
    ids=["500", "503-sem-json", "leitura", "conexao"],
)
def test_get_json_tries_again_after_a_temporary_failure(failure, waits: list[float]):
    client, requests = fake_client(answers(failure, httpx.Response(200, json={"ok": True})))

    assert get_json(client, URL, timeout=5.0) == (200, {"ok": True})
    assert len(requests) == 2
    assert waits == [RETRY_DELAY]


def test_get_json_returns_the_second_5xx(waits: list[float]):
    client, requests = fake_client(answers(*[httpx.Response(502, json={"erro": 1})] * 2))

    assert get_json(client, URL, timeout=5.0) == (502, {"erro": 1})
    assert len(requests) == 2


def test_get_json_gives_up_after_two_timeouts(waits: list[float]):
    client, requests = fake_client(httpx.ReadTimeout("demorou"))

    with pytest.raises(ExternalServiceError) as caught:
        get_json(client, URL, timeout=5.0)

    assert isinstance(caught.value.__cause__, httpx.ReadTimeout)
    assert len(requests) == 2


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(404, json={}),
        httpx.Response(429, json={}),
        httpx.Response(200, content=b"sem json"),
        httpx.ConnectError("sem rede"),
    ],
    ids=["404", "429", "200-sem-json", "sem-rede"],
)
def test_get_json_does_not_try_again_after_other_answers(response, waits: list[float]):
    client, requests = fake_client(response)

    try:
        get_json(client, URL, timeout=5.0)
    except ExternalServiceError:
        pass

    assert len(requests) == 1
    assert waits == []


def test_get_json_uses_the_given_delay(waits: list[float]):
    client, _ = fake_client(answers(httpx.Response(500, json={}), httpx.Response(200, json={})))

    get_json(client, URL, timeout=5.0, retry_delay=1.5)

    assert waits == [1.5]


def test_brasilapi_tries_again_after_a_timeout():
    client, requests = fake_client(
        answers(httpx.ReadTimeout("demorou"), httpx.Response(200, json=PAULISTA))
    )

    address = BrasilApiConnector(client).get_address("01310200")

    assert address.city == "São Paulo"
    assert len(requests) == 2


def test_cnpja_tries_again_after_a_5xx():
    client, requests = fake_client(
        answers(httpx.Response(500, json={}), httpx.Response(200, json=BANCO_DO_BRASIL))
    )

    company = CnpjaConnector(client).get_company("00000000000191")

    assert company.registration_status == "Ativa"
    assert len(requests) == 2


@pytest.mark.parametrize(
    "response, error",
    [
        (httpx.Response(429, json=RATE_LIMITED), RateLimitedError),
        (httpx.Response(404, json=NOT_FOUND), CnpjNotFoundError),
    ],
    ids=["cota", "inexistente"],
)
def test_cnpja_does_not_spend_the_quota_again_on_client_errors(response, error):
    client, requests = fake_client(response)
    connector = CnpjaConnector(client)

    with pytest.raises(error):
        connector.get_company("00000000000191")

    assert len(requests) == 1
