import re

import httpx
from pydantic import ValidationError

from src.connectors.exceptions import (
    CnpjNotFoundError,
    ExternalServiceError,
    InvalidCnpjError,
    RateLimitedError,
)
from src.connectors.http import DEFAULT_TIMEOUT, get_json
from src.connectors.models import Company

CNPJA_URL = "https://open.cnpja.com"
# desde julho de 2026 a Receita emite CNPJ alfanumérico, só os dois verificadores seguem numéricos
TAX_ID_PATTERN = re.compile(r"[A-Z0-9]{12}[0-9]{2}")
_STATUS_ERRORS = {400: InvalidCnpjError, 404: CnpjNotFoundError, 429: RateLimitedError}


class CnpjaConnector:
    def __init__(
        self, client: httpx.Client, base_url: str = CNPJA_URL, timeout: float = DEFAULT_TIMEOUT
    ):
        self.client = client
        self.base_url = base_url
        self.timeout = timeout

    def get_company(self, tax_id: str) -> Company:
        if not TAX_ID_PATTERN.fullmatch(tax_id):
            raise InvalidCnpjError(tax_id)
        status, body = get_json(self.client, f"{self.base_url}/office/{tax_id}", self.timeout)
        if status != 200:
            error_type = _STATUS_ERRORS.get(status, ExternalServiceError)
            raise error_type(f"{tax_id}: HTTP {status}")
        try:
            return Company(
                name=body["company"]["name"],
                registration_status=body["status"]["text"],
                cep=body["address"]["zip"] or None,
            )
        except (KeyError, TypeError, ValidationError) as exc:
            raise ExternalServiceError("resposta inesperada da CNPJá") from exc
