import json
import time
from typing import Any

import httpx

from src.connectors.exceptions import ExternalServiceError

DEFAULT_TIMEOUT = 5.0


def get_json(client: httpx.Client, url: str, timeout: float) -> tuple[int, Any]:
    # o timeout do httpx vale por leitura, e o prazo total é conferido a cada pedaço do corpo
    deadline = time.monotonic() + timeout
    try:
        with client.stream("GET", url, timeout=timeout, follow_redirects=False) as response:
            body = _read_body(response, deadline)
    except httpx.HTTPError as exc:
        raise ExternalServiceError(f"falha ao consultar {url}") from exc
    try:
        return response.status_code, json.loads(body)
    except (ValueError, RecursionError) as exc:
        raise ExternalServiceError(f"{url}: HTTP {response.status_code} sem JSON válido") from exc


def _read_body(response: httpx.Response, deadline: float) -> bytearray:
    body = bytearray()
    for chunk in response.iter_bytes():
        body += chunk
        if time.monotonic() >= deadline:
            raise ExternalServiceError("resposta excedeu o prazo total")
    return body
