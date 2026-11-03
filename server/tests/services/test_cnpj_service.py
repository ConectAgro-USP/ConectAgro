from unittest.mock import NonCallableMagicMock, create_autospec

import pytest

from src.connectors.cnpja import CnpjaConnector
from src.connectors.models import Company
from src.services.cnpj_service import CnpjService, normalize_cnpj
from src.services.exceptions import (
    CnpjNotActiveError,
    CnpjNotFoundError,
    ExternalServiceError,
    InvalidCnpjError,
    RateLimitedError,
)

BANCO_DO_BRASIL = Company(name="BANCO DO BRASIL SA", registration_status="Ativa", cep="70040912")


def fake_service(answer: Company | Exception) -> tuple[CnpjService, NonCallableMagicMock]:
    companies = create_autospec(CnpjaConnector, instance=True)
    companies.get_company.side_effect = [answer]
    return CnpjService(companies), companies


def test_get_active_company_looks_up_the_normalized_cnpj():
    service, companies = fake_service(BANCO_DO_BRASIL)

    company = service.get_active_company("00.000.000/0001-91")

    assert company == BANCO_DO_BRASIL
    companies.get_company.assert_called_once_with("00000000000191")


def test_get_active_company_rejects_company_that_is_not_active():
    service, _ = fake_service(BANCO_DO_BRASIL.model_copy(update={"registration_status": "Baixada"}))

    with pytest.raises(CnpjNotActiveError, match="Baixada"):
        service.get_active_company("00000000000191")


@pytest.mark.parametrize(
    "error", [InvalidCnpjError, CnpjNotFoundError, RateLimitedError, ExternalServiceError]
)
def test_get_active_company_propagates_the_connector_errors(error: type[Exception]):
    service, _ = fake_service(error("00000000000191"))

    with pytest.raises(error):
        service.get_active_company("00000000000191")


def test_get_active_company_rejects_invalid_cnpj_without_calling_the_api():
    service, companies = fake_service(BANCO_DO_BRASIL)

    with pytest.raises(InvalidCnpjError):
        service.get_active_company("00000000000190")

    companies.get_company.assert_not_called()


@pytest.mark.parametrize(
    "cnpj, tax_id",
    [
        ("00.000.000/0001-91", "00000000000191"),
        (" 00000000000191 ", "00000000000191"),
        ("00.000.000/E08G-12", "00000000E08G12"),
        ("00000000e08g12", "00000000E08G12"),
        ("00,000,000/0001-91", "00000000000191"),
        ("00_000_000_0001_91", "00000000000191"),
    ],
    ids=["pontuado", "com-espacos", "alfanumerico", "minusculo", "virgula", "sublinhado"],
)
def test_normalize_cnpj_strips_separators_and_upper_cases(cnpj: str, tax_id: str):
    assert normalize_cnpj(cnpj) == tax_id


# Itaú e Caixa, cujos restos 1 e 0 dão o primeiro verificador 0
@pytest.mark.parametrize(
    "cnpj", ["60701190000104", "00360305000104"], ids=["resto-um", "resto-zero"]
)
def test_normalize_cnpj_accepts_check_digit_zero(cnpj: str):
    assert normalize_cnpj(cnpj) == cnpj


@pytest.mark.parametrize(
    "cnpj",
    [
        "",
        "00000000000190",
        "00000000000181",
        "00000000E08G13",
        "０００００００００００１９１",
        "0000000000ß16",
        "0000000000019100000000000191",
    ],
    ids=[
        "vazio",
        "segundo-verificador-errado",
        "primeiro-verificador-errado",
        "alfanumerico-com-verificador-errado",
        "digitos-nao-ascii",
        "letra-nao-ascii",
        "colado-duas-vezes",
    ],
)
def test_normalize_cnpj_rejects_invalid_values(cnpj: str):
    with pytest.raises(InvalidCnpjError):
        normalize_cnpj(cnpj)
