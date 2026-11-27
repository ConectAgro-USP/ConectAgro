import json
import time
from typing import Any

import httpx

from src.connectors.exceptions import ExternalServiceError

DEFAULT_TIMEOUT = 5.0
# espera curta antes da única nova tentativa, o usuário segue aguardando
RETRY_DELAY = 0.3


class _TemporaryFailure(ExternalServiceError):
    pass


def get_json(
    client: httpx.Client, url: str, timeout: float, retry_delay: float = RETRY_DELAY
) -> tuple[int, Any]:
    try:
        status_code, body = _fetch(client, url, timeout)
        if status_code < 500:
            return status_code, _parse(url, status_code, body)
    except _TemporaryFailure:
        pass
    time.sleep(retry_delay)
    status_code, body = _fetch(client, url, timeout)
    return status_code, _parse(url, status_code, body)


def _fetch(client: httpx.Client, url: str, timeout: float) -> tuple[int, bytearray]:
    # o timeout do httpx vale por leitura, e o prazo total é conferido a cada pedaço do corpo
    deadline = time.monotonic() + timeout
    try:
        with client.stream("GET", url, timeout=timeout, follow_redirects=False) as response:
            body = _read_body(response, deadline)
    except httpx.TimeoutException as exc:
        raise _TemporaryFailure(f"tempo esgotado ao consultar {url}") from exc
    except httpx.HTTPError as exc:
        raise ExternalServiceError(f"falha ao consultar {url}") from exc
    return response.status_code, body


def _parse(url: str, status_code: int, body: bytearray) -> Any:
    try:
        return json.loads(body)
    except (ValueError, RecursionError) as exc:
        raise ExternalServiceError(f"{url}: HTTP {status_code} sem JSON válido") from exc


def _read_body(response: httpx.Response, deadline: float) -> bytearray:
    body = bytearray()
    for chunk in response.iter_bytes():
        body += chunk
        if time.monotonic() >= deadline:
            raise _TemporaryFailure("resposta excedeu o prazo total")
    return body
