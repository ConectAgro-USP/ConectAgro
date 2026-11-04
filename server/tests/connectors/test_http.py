import itertools
import time

import httpx
import pytest

from src.connectors.exceptions import ExternalServiceError
from src.connectors.http import get_json
from tests.connectors.fakes import fake_client

URL = "https://api.exemplo/recurso"


def counted(chunks: list[bytes], sent: list[bytes]):
    for chunk in chunks:
        sent.append(chunk)
        yield chunk


def test_get_json_returns_the_body_and_sets_the_timeout():
    client, requests = fake_client(httpx.Response(200, json={"ok": True}))

    assert get_json(client, URL, timeout=5.0) == (200, {"ok": True})
    assert requests[0].extensions["timeout"] == httpx.Timeout(5.0).as_dict()


def test_get_json_joins_the_chunks_of_the_body():
    client, _ = fake_client(httpx.Response(200, content=iter([b'{"a"', b": 1}"])))

    assert get_json(client, URL, timeout=5.0) == (200, {"a": 1})


def test_get_json_rejects_deeply_nested_json():
    client, _ = fake_client(httpx.Response(200, content=b"[" * 100_000 + b"]" * 100_000))

    with pytest.raises(ExternalServiceError, match="sem JSON válido"):
        get_json(client, URL, timeout=5.0)


def test_get_json_returns_redirects_without_following_them():
    client, requests = fake_client(
        httpx.Response(302, json={}, headers={"Location": "http://10.0.0.1/"}),
        follow_redirects=True,
    )

    assert get_json(client, URL, timeout=5.0) == (302, {})
    assert len(requests) == 1


def test_get_json_checks_the_deadline_on_every_chunk(monkeypatch: pytest.MonkeyPatch):
    # cada leitura do relógio avança 1 s, então o prazo de 3 s vence no meio do corpo
    clock = itertools.count()
    monkeypatch.setattr(time, "monotonic", lambda: next(clock))
    sent: list[bytes] = []
    client, _ = fake_client(httpx.Response(200, content=counted([b" "] * 20, sent)))

    with pytest.raises(ExternalServiceError, match="prazo"):
        get_json(client, URL, timeout=3)

    assert len(sent) == 3


@pytest.mark.parametrize(
    "body", [b"Too Many Requests", "Requisições demais".encode("latin-1")], ids=["texto", "latin-1"]
)
def test_get_json_keeps_the_status_when_the_body_is_not_json(body: bytes):
    client, _ = fake_client(httpx.Response(429, content=body))

    with pytest.raises(ExternalServiceError, match="429") as caught:
        get_json(client, URL, timeout=5.0)

    assert isinstance(caught.value.__cause__, ValueError)


def test_get_json_keeps_the_transport_error_as_cause():
    client, _ = fake_client(httpx.ReadTimeout("demorou"))

    with pytest.raises(ExternalServiceError) as caught:
        get_json(client, URL, timeout=5.0)

    assert isinstance(caught.value.__cause__, httpx.ReadTimeout)
