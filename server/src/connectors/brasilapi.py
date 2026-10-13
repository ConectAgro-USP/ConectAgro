import re

import httpx
from pydantic import ValidationError

from src.connectors.exceptions import CepNotFoundError, ExternalServiceError, InvalidCepError
from src.connectors.http import DEFAULT_TIMEOUT, get_json
from src.connectors.models import Address, Coordinates

BRASILAPI_URL = "https://brasilapi.com.br/api"
_CEP = re.compile(r"([0-9]{5})-?([0-9]{3})")
_STATUS_ERRORS = {400: InvalidCepError, 404: CepNotFoundError}


class BrasilApiConnector:
    def __init__(
        self, client: httpx.Client, base_url: str = BRASILAPI_URL, timeout: float = DEFAULT_TIMEOUT
    ):
        self.client = client
        self.base_url = base_url
        self.timeout = timeout

    def get_address(self, cep: str) -> Address:
        digits = _normalize_cep(cep)
        status, body = get_json(self.client, f"{self.base_url}/cep/v2/{digits}", self.timeout)
        if status != 200:
            error_type = _STATUS_ERRORS.get(status, ExternalServiceError)
            raise error_type(f"{cep}: HTTP {status}")
        try:
            return Address.model_validate({**body, "coordinates": _coordinates(body)})
        except (AttributeError, TypeError, ValidationError) as exc:
            raise ExternalServiceError("resposta inesperada da BrasilAPI") from exc


def _normalize_cep(cep: str) -> str:
    match = _CEP.fullmatch(cep.strip())
    if match is None:
        raise InvalidCepError(cep)
    return "".join(match.groups())


def _coordinates(body: dict) -> Coordinates | None:
    raw = (body.get("location") or {}).get("coordinates") or {}
    latitude, longitude = raw.get("latitude"), raw.get("longitude")
    if latitude in (None, "") or longitude in (None, ""):
        return None
    return Coordinates(latitude=latitude, longitude=longitude)
