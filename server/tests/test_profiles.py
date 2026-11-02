from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.api.deps import (
    get_brasilapi_connector,
    get_cnpja_connector,
    get_current_apartment,
    get_current_buyer,
    get_current_farmer,
)
from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.cnpja import CnpjaConnector
from src.main import app
from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.user import User
from tests.connectors.fakes import fake_client
from tests.connectors.test_brasilapi import ACRELANDIA, PAULISTA
from tests.connectors.test_cnpja import BANCO_DO_BRASIL, NOT_FOUND, RATE_LIMITED
from tests.helpers import (
    ITAU_CNPJ,
    add_building,
    add_farmer,
    add_resident,
    add_user,
)

FARMER = {"zip_code": "01310-200"}
APARTMENT = {
    "building_name": "Edifício Araraquara",
    "zip_code": "01310-200",
    "manager_name": "Matheus Silveira",
    "building_cnpj": "00.000.000/0001-91",
}
WITHOUT_COORDINATES = {**PAULISTA, "location": {"type": "Point", "coordinates": {}}}
CEP_INVALID = {"type": "validation_error"}
CEP_NOT_FOUND = {"type": "service_error"}
CNPJ_CLOSED = {**BANCO_DO_BRASIL, "status": {"text": "Baixada"}}


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


@pytest.fixture(autouse=True)
def cep_requests() -> list[httpx.Request]:
    return answer_cep(httpx.Response(200, json=PAULISTA))


@pytest.fixture(autouse=True)
def cnpj_requests() -> list[httpx.Request]:
    return answer_cnpj(httpx.Response(200, json=BANCO_DO_BRASIL))


def test_create_farmer_profile(client: TestClient, ana: User, cep_requests: list[httpx.Request]):
    response = client.post("/api/profiles/farmer", json=FARMER)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["profile_type"] == "farmer"
    assert response.json()["farmer"]["zip_code"] == "01310200"
    assert cep_requests[0].url.path == "/api/cep/v2/01310200"


def test_create_apartment_profile(
    client: TestClient,
    ana: User,
    cnpj_requests: list[httpx.Request],
):
    response = client.post("/api/profiles/apartment", json=APARTMENT)

    apartment = response.json()["apartment"]
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["profile_type"] == "apartment"
    assert response.json()["name"] == "Matheus Silveira"
    assert apartment["building_name"] == "Edifício Araraquara"
    assert apartment["zip_code"] == "01310200"
    assert apartment["building_cnpj"] == "00000000000191"
    assert cnpj_requests[0].url.path == "/office/00000000000191"


def test_create_buyer_profile_starts_pending(client: TestClient, ana: User, building: Apartment):
    payload = {"apartment_public_id": str(building.public_id), "block": "B", "unit": "42"}

    response = client.post("/api/profiles/buyer", json=payload)

    buyer = response.json()["buyer"]
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["profile_type"] == "buyer"
    assert buyer["apartment"]["public_id"] == str(building.public_id)
    assert buyer["block"] == "B"
    assert buyer["unit"] == "42"
    assert buyer["link_status"] == "PENDENTE"
    assert buyer["link_requested_at"] is not None
    assert buyer["link_reviewed_at"] is None


def test_create_buyer_profile_for_unknown_building(client: TestClient, ana: User):
    response = client.post(
        "/api/profiles/buyer", json={"apartment_public_id": str(uuid4()), "unit": "42"}
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert response.json()["detail"] == "Prédio não encontrado"


@pytest.mark.parametrize("existing_profile", ["farmer", "apartment", "buyer"])
def test_user_with_profile_cannot_create_another(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
    cep_requests: list[httpx.Request],
    cnpj_requests: list[httpx.Request],
    existing_profile: str,
):
    if existing_profile == "farmer":
        add_farmer(session, ana)
    if existing_profile == "apartment":
        add_building(session, ana, name="Edifício Bauru")
    if existing_profile == "buyer":
        add_resident(session, building, ana)
    buyer_payload = {"apartment_public_id": str(building.public_id), "unit": "42"}

    farmer_response = client.post("/api/profiles/farmer", json=FARMER)
    apartment_response = client.post("/api/profiles/apartment", json=APARTMENT)
    buyer_response = client.post("/api/profiles/buyer", json=buyer_payload)

    assert farmer_response.status_code == status.HTTP_409_CONFLICT
    assert apartment_response.status_code == status.HTTP_409_CONFLICT
    assert buyer_response.status_code == status.HTTP_409_CONFLICT
    assert farmer_response.json()["detail"] == "Você já tem um perfil"
    assert apartment_response.json()["detail"] == "Você já tem um perfil"
    assert buyer_response.json()["detail"] == "Você já tem um perfil"
    assert client.get("/api/profiles/me").json()["profile_type"] == existing_profile
    assert cep_requests == []
    assert cnpj_requests == []


@pytest.mark.parametrize(
    "path, payload",
    [("/api/profiles/farmer", FARMER), ("/api/profiles/apartment", APARTMENT)],
    ids=["agricultor", "sindico"],
)
def test_cep_without_coordinates_asks_for_a_nearby_cep(
    client: TestClient,
    ana: User,
    cnpj_requests: list[httpx.Request],
    path: str,
    payload: dict,
):
    answer_cep(httpx.Response(200, json=WITHOUT_COORDINATES))

    response = client.post(path, json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert "CEP próximo" in response.json()["detail"]
    assert client.get("/api/profiles/me").json()["profile_type"] is None
    assert cnpj_requests == []


@pytest.mark.parametrize(
    "path, payload, answer, status_code",
    [
        ("/api/profiles/farmer", FARMER, httpx.Response(400, json=CEP_INVALID), 422),
        ("/api/profiles/farmer", FARMER, httpx.Response(404, json=CEP_NOT_FOUND), 422),
        ("/api/profiles/farmer", FARMER, httpx.Response(500, json={}), 503),
        ("/api/profiles/farmer", FARMER, httpx.ConnectError("sem rede"), 503),
        ("/api/profiles/apartment", APARTMENT, httpx.Response(400, json=CEP_INVALID), 422),
        ("/api/profiles/apartment", APARTMENT, httpx.Response(404, json=CEP_NOT_FOUND), 422),
        ("/api/profiles/apartment", APARTMENT, httpx.Response(500, json={}), 503),
    ],
    ids=[
        "agricultor-invalido",
        "agricultor-inexistente",
        "agricultor-erro-da-api",
        "agricultor-sem-rede",
        "sindico-invalido",
        "sindico-inexistente",
        "sindico-erro-da-api",
    ],
)
def test_cep_lookup_errors(
    client: TestClient,
    ana: User,
    path: str,
    payload: dict,
    answer: httpx.Response | Exception,
    status_code: int,
):
    answer_cep(answer)

    response = client.post(path, json=payload)

    assert response.status_code == status_code
    assert client.get("/api/profiles/me").json()["profile_type"] is None


@pytest.mark.parametrize("zip_code", ["0131-0200", "abcde-fgh", "0" * 50])
def test_malformed_cep_is_rejected_without_calling_the_api(
    client: TestClient,
    ana: User,
    cep_requests: list[httpx.Request],
    zip_code: str,
):
    response = client.post("/api/profiles/farmer", json={"zip_code": zip_code})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert cep_requests == []


def test_invalid_cnpj_is_rejected_without_calling_the_apis(
    client: TestClient,
    ana: User,
    cep_requests: list[httpx.Request],
    cnpj_requests: list[httpx.Request],
):
    response = client.post(
        "/api/profiles/apartment", json={**APARTMENT, "building_cnpj": "00.000.000/0001-90"}
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert cep_requests == []
    assert cnpj_requests == []


@pytest.mark.parametrize(
    "answer, status_code",
    [
        (httpx.Response(404, json=NOT_FOUND), 422),
        (httpx.Response(200, json=CNPJ_CLOSED), 422),
        (httpx.Response(429, json=RATE_LIMITED), 503),
        (httpx.Response(500, json={}), 503),
        (httpx.ConnectError("sem rede"), 503),
    ],
    ids=["inexistente", "baixado", "cota-esgotada", "api-fora-do-ar", "sem-rede"],
)
def test_cnpj_lookup_answers(
    client: TestClient,
    ana: User,
    answer: httpx.Response | Exception,
    status_code: int,
):
    answer_cnpj(answer)

    response = client.post("/api/profiles/apartment", json=APARTMENT)

    assert response.status_code == status_code
    assert client.get("/api/profiles/me").json()["profile_type"] is None


@pytest.mark.parametrize(
    "path, payload",
    [
        ("/api/profiles/farmer", {**FARMER, "cellphone": "11944644502"}),
        ("/api/profiles/apartment", {**APARTMENT, "manager_id": 1}),
        ("/api/profiles/buyer", {"apartment_public_id": str(uuid4()), "unit": "42", "x": 1}),
    ],
    ids=["agricultor", "sindico", "morador"],
)
def test_create_profile_rejects_unknown_fields(
    client: TestClient,
    ana: User,
    path: str,
    payload: dict,
):
    response = client.post(path, json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.get("/api/profiles/me").json()["profile_type"] is None


def test_free_text_fields_reject_the_null_character(
    client: TestClient,
    ana: User,
    building: Apartment,
):
    apartment_payload = {**APARTMENT, "building_name": "Ed\x00"}
    buyer_payload = {"apartment_public_id": str(building.public_id), "block": "B\x00", "unit": "42"}

    apartment_response = client.post("/api/profiles/apartment", json=apartment_payload)
    buyer_response = client.post("/api/profiles/buyer", json=buyer_payload)

    assert apartment_response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert buyer_response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_read_profile_without_profile(client: TestClient, ana: User):
    response = client.get("/api/profiles/me")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "profile_type": None,
        "name": "Ana Souza",
        "email": "ana@example.com",
        "picture_url": None,
        "cellphone": None,
        "homephone": None,
        "farmer": None,
        "apartment": None,
        "buyer": None,
    }


def test_read_profile_of_buyer_shows_building_and_link_status(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
):
    add_resident(session, building, ana, link_status=LinkStatus.APROVADO)

    buyer = client.get("/api/profiles/me").json()["buyer"]

    assert buyer["link_status"] == "APROVADO"
    assert buyer["apartment"] == {
        "public_id": str(building.public_id),
        "building_name": "Edifício Araraquara",
        "zip_code": "01310200",
    }


def test_update_name_and_phones(client: TestClient, ana: User):
    changes = {"name": "Ana Lima", "cellphone": "(11) 94464-4502", "homephone": "11 2464-4502"}

    response = client.patch("/api/profiles/me", json=changes)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "Ana Lima"
    assert response.json()["cellphone"] == "11944644502"
    assert response.json()["homephone"] == "1124644502"


@pytest.mark.parametrize(
    "changes",
    [
        {"cellphone": "123"},
        {"cellphone": "(11) 94464-4502" + " " * 10},
        {"homephone": "11944644502"},
        {"name": None},
        {"name": "A"},
        {"name": "Ana\x00Lima"},
        {"manager_name": "Ana Lima"},
    ],
    ids=[
        "celular-invalido",
        "celular-longo",
        "fixo-invalido",
        "nome-nulo",
        "nome-curto",
        "nome-com-caractere-nulo",
        "campo-desconhecido",
    ],
)
def test_update_rejects_invalid_user_fields(client: TestClient, ana: User, changes: dict):
    response = client.patch("/api/profiles/me", json=changes)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.get("/api/profiles/me").json()["name"] == "Ana Souza"


def test_update_clears_homephone_with_null(client: TestClient, ana: User):
    client.patch("/api/profiles/me", json={"homephone": "1124644502"})

    response = client.patch("/api/profiles/me", json={"homephone": None})

    assert response.json()["homephone"] is None


@pytest.mark.parametrize(
    "path, payload, profile",
    [
        ("/api/profiles/farmer", FARMER, "farmer"),
        ("/api/profiles/apartment", APARTMENT, "apartment"),
    ],
    ids=["agricultor", "sindico"],
)
def test_update_cep(client: TestClient, ana: User, path: str, payload: dict, profile: str):
    client.post(path, json=payload)
    cep_requests = answer_cep(httpx.Response(200, json=ACRELANDIA))

    response = client.patch("/api/profiles/me", json={"zip_code": "69945-000"})

    assert response.json()[profile]["zip_code"] == "69945000"
    assert cep_requests[0].url.path == "/api/cep/v2/69945000"


@pytest.mark.parametrize(
    "path, payload, zip_code",
    [
        ("/api/profiles/farmer", FARMER, "01310200"),
        ("/api/profiles/farmer", FARMER, "01310-200"),
        ("/api/profiles/apartment", APARTMENT, "01310-200"),
    ],
    ids=["agricultor-sem-traco", "agricultor-com-traco", "sindico-com-traco"],
)
def test_update_with_the_same_cep_skips_the_api(
    client: TestClient,
    ana: User,
    cep_requests: list[httpx.Request],
    path: str,
    payload: dict,
    zip_code: str,
):
    client.post(path, json=payload)
    cep_requests.clear()

    response = client.patch("/api/profiles/me", json={"zip_code": zip_code})

    assert response.status_code == status.HTTP_200_OK
    assert cep_requests == []


def test_update_rejects_malformed_cep_with_the_same_digits(
    client: TestClient,
    ana: User,
    cep_requests: list[httpx.Request],
):
    client.post("/api/profiles/farmer", json=FARMER)
    cep_requests.clear()

    response = client.patch("/api/profiles/me", json={"zip_code": "0131-0200"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert cep_requests == []


@pytest.mark.parametrize(
    "path, payload, profile, original_name",
    [
        ("/api/profiles/farmer", FARMER, "farmer", "Ana Souza"),
        ("/api/profiles/apartment", APARTMENT, "apartment", "Matheus Silveira"),
    ],
    ids=["agricultor", "sindico"],
)
def test_failed_update_changes_nothing(
    client: TestClient,
    ana: User,
    path: str,
    payload: dict,
    profile: str,
    original_name: str,
):
    client.post(path, json=payload)
    answer_cep(httpx.Response(200, json={**ACRELANDIA, "location": None}))

    response = client.patch("/api/profiles/me", json={"name": "Ana Lima", "zip_code": "69945000"})

    profile_after = client.get("/api/profiles/me").json()
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert profile_after["name"] == original_name
    assert profile_after[profile]["zip_code"] == "01310200"


@pytest.mark.parametrize(
    "cep_answer, cnpj_answer, status_code",
    [
        (httpx.Response(404, json=CEP_NOT_FOUND), httpx.Response(200, json=BANCO_DO_BRASIL), 422),
        (httpx.Response(500, json={}), httpx.Response(200, json=BANCO_DO_BRASIL), 503),
        (httpx.Response(200, json=ACRELANDIA), httpx.Response(404, json=NOT_FOUND), 422),
        (httpx.Response(200, json=ACRELANDIA), httpx.Response(200, json=CNPJ_CLOSED), 422),
        (httpx.Response(200, json=ACRELANDIA), httpx.Response(429, json=RATE_LIMITED), 503),
        (httpx.Response(200, json=ACRELANDIA), httpx.Response(500, json={}), 503),
    ],
    ids=[
        "cep-inexistente",
        "cep-fora-do-ar",
        "cnpj-inexistente",
        "cnpj-baixado",
        "cota-esgotada",
        "cnpj-fora-do-ar",
    ],
)
def test_update_apartment_reports_lookup_errors(
    client: TestClient,
    ana: User,
    cep_answer: httpx.Response,
    cnpj_answer: httpx.Response,
    status_code: int,
):
    client.post("/api/profiles/apartment", json=APARTMENT)
    answer_cep(cep_answer)
    answer_cnpj(cnpj_answer)
    changes = {"zip_code": "69945-000", "building_cnpj": ITAU_CNPJ}

    response = client.patch("/api/profiles/me", json=changes)

    apartment = client.get("/api/profiles/me").json()["apartment"]
    assert response.status_code == status_code
    assert apartment["zip_code"] == "01310200"
    assert apartment["building_cnpj"] == "00000000000191"


def test_update_apartment_checks_the_new_cnpj(client: TestClient, ana: User):
    client.post("/api/profiles/apartment", json=APARTMENT)
    cnpj_requests = answer_cnpj(httpx.Response(200, json=BANCO_DO_BRASIL))
    changes = {"building_name": "Edifício Bauru", "building_cnpj": "60.701.190/0001-04"}

    response = client.patch("/api/profiles/me", json=changes)

    apartment = response.json()["apartment"]
    assert apartment["building_name"] == "Edifício Bauru"
    assert apartment["building_cnpj"] == ITAU_CNPJ
    assert cnpj_requests[0].url.path == f"/office/{ITAU_CNPJ}"


def test_update_apartment_checks_the_cep_before_the_cnpj_api(
    client: TestClient,
    ana: User,
    cnpj_requests: list[httpx.Request],
):
    client.post("/api/profiles/apartment", json=APARTMENT)
    cnpj_requests.clear()
    answer_cep(httpx.Response(200, json=WITHOUT_COORDINATES))
    changes = {"building_cnpj": ITAU_CNPJ, "zip_code": "69945-000"}

    response = client.patch("/api/profiles/me", json=changes)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert cnpj_requests == []


def test_update_apartment_with_the_same_cnpj_skips_the_api(
    client: TestClient,
    ana: User,
    cnpj_requests: list[httpx.Request],
):
    client.post("/api/profiles/apartment", json=APARTMENT)
    cnpj_requests.clear()

    response = client.patch("/api/profiles/me", json={"building_cnpj": "00.000.000/0001-91"})

    assert response.status_code == status.HTTP_200_OK
    assert cnpj_requests == []


def test_update_apartment_rejects_invalid_cnpj_without_calling_the_apis(
    client: TestClient,
    ana: User,
    cep_requests: list[httpx.Request],
    cnpj_requests: list[httpx.Request],
):
    client.post("/api/profiles/apartment", json=APARTMENT)
    cep_requests.clear()
    cnpj_requests.clear()
    changes = {"building_cnpj": "00.000.000/0001-90", "zip_code": "69945-000"}

    response = client.patch("/api/profiles/me", json=changes)

    apartment = client.get("/api/profiles/me").json()["apartment"]
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert apartment["building_cnpj"] == "00000000000191"
    assert apartment["zip_code"] == "01310200"
    assert cep_requests == []
    assert cnpj_requests == []


@pytest.mark.parametrize(
    "changes",
    [{"block": "C", "unit": "43"}, {"block": "C"}, {"unit": "43"}, {"block": None}],
    ids=["bloco-e-numero", "so-bloco", "so-numero", "sem-bloco"],
)
def test_update_buyer_unit_asks_for_approval_again(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
    changes: dict,
):
    resident = add_resident(session, building, ana, link_status=LinkStatus.APROVADO)
    resident.block = "B"
    resident.link_requested_at = datetime(2026, 1, 1, tzinfo=UTC)
    resident.link_reviewed_at = datetime(2026, 1, 2, tzinfo=UTC)
    session.commit()

    response = client.patch("/api/profiles/me", json=changes)

    buyer = response.json()["buyer"]
    for field in changes:
        assert buyer[field] == changes[field]
    assert buyer["link_status"] == "PENDENTE"
    assert not buyer["link_requested_at"].startswith("2026-01-01")
    assert buyer["link_reviewed_at"] is None


def test_buyer_keeps_the_approval_when_resending_the_same_link(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
):
    add_resident(session, building, ana, link_status=LinkStatus.APROVADO)
    same_link = {"apartment_public_id": str(building.public_id), "block": None, "unit": "42"}

    response = client.patch("/api/profiles/me", json=same_link)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["buyer"]["link_status"] == "APROVADO"


def test_buyer_keeps_the_approval_when_editing_contact_data(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
):
    add_resident(session, building, ana, link_status=LinkStatus.APROVADO)

    response = client.patch(
        "/api/profiles/me", json={"name": "Ana Lima", "cellphone": "11944644502"}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["buyer"]["link_status"] == "APROVADO"


@pytest.mark.parametrize("same_building", [True, False], ids=["mesmo-predio", "outro-predio"])
def test_rejected_buyer_can_ask_again(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
    same_building: bool,
):
    other_manager = add_user(session, "outro.sindico@example.com")
    other_building = add_building(session, other_manager, name="Edifício Bauru")
    if same_building:
        target = building
    else:
        target = other_building
    add_resident(session, building, ana, link_status=LinkStatus.RECUSADO)

    response = client.patch("/api/profiles/me", json={"apartment_public_id": str(target.public_id)})

    buyer = response.json()["buyer"]
    assert buyer["apartment"]["public_id"] == str(target.public_id)
    assert buyer["link_status"] == "PENDENTE"


def test_update_buyer_to_unknown_building(
    client: TestClient,
    session: Session,
    ana: User,
    building: Apartment,
):
    add_resident(session, building, ana)

    response = client.patch("/api/profiles/me", json={"apartment_public_id": str(uuid4())})

    buyer = client.get("/api/profiles/me").json()["buyer"]
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert buyer["apartment"]["public_id"] == str(building.public_id)


@pytest.mark.parametrize("unit", ["", "12345678901", "42\x00"], ids=["vazia", "longa", "nulo"])
def test_buyer_unit_is_validated(client: TestClient, ana: User, building: Apartment, unit: str):
    payload = {"apartment_public_id": str(building.public_id), "unit": unit}

    response = client.post("/api/profiles/buyer", json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.parametrize(
    "has_farmer_profile, changes",
    [
        (True, {"building_cnpj": ITAU_CNPJ}),
        (True, {"unit": "42"}),
        (False, {"zip_code": "01310-200"}),
    ],
    ids=["agricultor-com-cnpj", "agricultor-com-unidade", "sem-perfil-com-cep"],
)
def test_update_rejects_fields_of_another_profile(
    client: TestClient,
    ana: User,
    has_farmer_profile: bool,
    changes: dict,
):
    if has_farmer_profile:
        client.post("/api/profiles/farmer", json=FARMER)

    response = client.patch("/api/profiles/me", json=changes)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert "não faz parte do seu perfil" in response.json()["detail"]


@pytest.mark.parametrize(
    "method, path",
    [
        ("POST", "/api/profiles/farmer"),
        ("POST", "/api/profiles/apartment"),
        ("POST", "/api/profiles/buyer"),
        ("GET", "/api/profiles/me"),
        ("PATCH", "/api/profiles/me"),
    ],
)
def test_profile_routes_require_login(client: TestClient, method: str, path: str):
    response = client.request(method, path, json={})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_profile_dependencies_reject_user_without_the_profile(ana: User):
    with pytest.raises(HTTPException) as farmer_error:
        get_current_farmer(ana)
    with pytest.raises(HTTPException) as apartment_error:
        get_current_apartment(ana)
    with pytest.raises(HTTPException) as buyer_error:
        get_current_buyer(ana)

    assert farmer_error.value.status_code == status.HTTP_403_FORBIDDEN
    assert apartment_error.value.status_code == status.HTTP_403_FORBIDDEN
    assert buyer_error.value.status_code == status.HTTP_403_FORBIDDEN


def test_current_farmer_returns_the_farmer(session: Session, ana: User):
    add_farmer(session, ana)

    farmer = get_current_farmer(ana)

    assert farmer.user_id == ana.id


def test_current_apartment_returns_the_managers_building(session: Session):
    # outro usuário antes, para o id do síndico não coincidir com o do prédio
    add_user(session, "outra@example.com")
    manager = add_user(session, "sindico@example.com")
    building = add_building(session, manager)

    apartment = get_current_apartment(manager)

    assert apartment.id == building.id


@pytest.mark.parametrize(
    "link_status, message",
    [(LinkStatus.PENDENTE, "aguardando aprovação"), (LinkStatus.RECUSADO, "recusado")],
)
def test_current_buyer_requires_an_approved_link(
    session: Session,
    ana: User,
    building: Apartment,
    link_status: LinkStatus,
    message: str,
):
    add_resident(session, building, ana, link_status=link_status)

    with pytest.raises(HTTPException) as caught:
        get_current_buyer(ana)

    assert caught.value.status_code == status.HTTP_403_FORBIDDEN
    assert message in caught.value.detail


def test_current_buyer_returns_an_approved_buyer(session: Session, ana: User, building: Apartment):
    resident = add_resident(session, building, ana, link_status=LinkStatus.APROVADO)

    buyer = get_current_buyer(ana)

    assert buyer.id == resident.id
