import httpx

from src.api.deps import get_brasilapi_connector, get_cnpja_connector
from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.cnpja import CnpjaConnector
from src.main import app
from tests.connectors.fakes import fake_client

CPF = "529.982.247-25"
COMMON_FIELDS = {"cpf": CPF, "cellphone": "(11) 94464-4502"}
FARMER = {**COMMON_FIELDS, "farm_name": "Sítio Boa Vista", "zip_code": "01310-200"}
APARTMENT = {**COMMON_FIELDS, "building_cnpj": "00.000.000/0001-91", "zip_code": "01310-200"}


def answer_cep(response) -> list[httpx.Request]:
    client, requests = fake_client(response)

    def fake_brasilapi() -> BrasilApiConnector:
        return BrasilApiConnector(client)

    app.dependency_overrides[get_brasilapi_connector] = fake_brasilapi
    return requests


def answer_cnpj(response) -> list[httpx.Request]:
    client, requests = fake_client(response)

    def fake_cnpja() -> CnpjaConnector:
        return CnpjaConnector(client)

    app.dependency_overrides[get_cnpja_connector] = fake_cnpja
    return requests
