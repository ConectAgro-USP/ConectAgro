import re

from pydantic import BaseModel

from src.connectors.cnpja import TAX_ID_PATTERN, CnpjaConnector
from src.connectors.models import Company
from src.services.exceptions import CnpjNotActiveError, ExternalServiceError, InvalidCnpjError

NON_ALPHANUMERIC = re.compile(r"[^A-Za-z0-9]")
WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]


class CnpjValidation(BaseModel):
    tax_id: str
    # None quando a consulta à CNPJá falhou, e o cadastro segue com aviso
    company: Company | None = None


class CnpjService:
    def __init__(self, companies: CnpjaConnector):
        self.companies = companies

    def validate(self, cnpj: str) -> CnpjValidation:
        tax_id = normalize_cnpj(cnpj)
        # RateLimitedError propaga, pois quem esgota a cota de propósito pularia a conferência
        try:
            company = self.companies.get_company(tax_id)
        except ExternalServiceError:
            return CnpjValidation(tax_id=tax_id)
        if company.registration_status != "Ativa":
            raise CnpjNotActiveError(company.registration_status)
        return CnpjValidation(tax_id=tax_id, company=company)


def normalize_cnpj(cnpj: str) -> str:
    tax_id = NON_ALPHANUMERIC.sub("", cnpj).upper()
    if not TAX_ID_PATTERN.fullmatch(tax_id) or not tax_id.endswith(_check_digits(tax_id[:12])):
        raise InvalidCnpjError(cnpj)
    return tax_id


def _check_digits(base: str) -> str:
    first = _check_digit(base)
    return first + _check_digit(base + first)


def _check_digit(chars: str) -> str:
    # o primeiro verificador usa 12 pesos e o segundo 13, por isso o corte pela direita
    weights = WEIGHTS[-len(chars) :]
    # letras valem o código ASCII menos 48, como manda a Receita
    total = sum((ord(char) - 48) * weight for char, weight in zip(chars, weights, strict=True))
    remainder = total % 11
    return "0" if remainder < 2 else str(11 - remainder)
