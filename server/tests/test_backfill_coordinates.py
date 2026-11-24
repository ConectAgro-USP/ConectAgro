import httpx
import pytest
from sqlmodel import Session

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.models import Address
from src.models.farmer import Farmer
from src.repository.profile_repository import ProfileRepository
from src.scripts import backfill_coordinates as script
from src.services.cep_service import CepService
from src.services.recent_cache import RecentCache
from tests.conftest import engine_test
from tests.connectors.fakes import fake_client
from tests.connectors.test_brasilapi import ACRELANDIA, NOT_FOUND, PAULISTA
from tests.helpers import add_building, add_farmer, add_user

ANSWERS = {
    "01310200": httpx.Response(200, json=PAULISTA),
    "69945000": httpx.Response(200, json={**ACRELANDIA, "location": None}),
    "99999999": httpx.Response(404, json=NOT_FOUND),
}
PAULISTA_POINT = (-23.5475, -46.63611)


def by_cep(request: httpx.Request) -> httpx.Response:
    return ANSWERS[request.url.path[-8:]]


@pytest.fixture
def cep_requests() -> list[httpx.Request]:
    return []


@pytest.fixture
def run(session: Session, cep_requests: list[httpx.Request]):
    client, requests = fake_client(by_cep)
    ceps = CepService(BrasilApiConnector(client), RecentCache[Address](keep_seconds=60))

    def run_script() -> script.BackfillSummary:
        summary = script.backfill_coordinates(ProfileRepository(session), ceps)
        cep_requests.extend(requests)
        return summary

    return run_script


def farmer_with_cep(session: Session, email: str, cep: str) -> Farmer:
    farmer = add_farmer(session, add_user(session, email))
    farmer.zip_code = cep
    session.commit()
    return farmer


def test_fills_farmers_and_buildings_asking_each_cep_once(
    session: Session, run, cep_requests: list[httpx.Request]
):
    first = farmer_with_cep(session, "a@example.com", "01310200")
    second = farmer_with_cep(session, "b@example.com", "01310200")
    building = add_building(session, add_user(session, "s@example.com"))

    summary = run()

    for profile in (first, second, building):
        session.refresh(profile)
        assert (profile.latitude, profile.longitude) == PAULISTA_POINT
    assert summary.filled == 3
    assert summary.skipped == []
    assert len(cep_requests) == 1


def test_skips_ceps_without_coordinates_or_not_found(session: Session, run):
    no_point = farmer_with_cep(session, "a@example.com", "69945000")
    missing = farmer_with_cep(session, "b@example.com", "99999999")
    found = farmer_with_cep(session, "c@example.com", "01310200")

    summary = run()

    session.refresh(no_point)
    session.refresh(found)
    assert no_point.latitude is None
    assert (found.latitude, found.longitude) == PAULISTA_POINT
    assert summary.filled == 1
    assert summary.skipped == [
        f"agricultor {no_point.public_id}, CEP 69945000: CEP sem coordenadas",
        f"agricultor {missing.public_id}, CEP 99999999: CepNotFoundError",
    ]


def test_leaves_profiles_with_coordinates_alone(
    session: Session, run, cep_requests: list[httpx.Request]
):
    building = add_building(session, add_user(session, "s@example.com"))
    building.latitude, building.longitude = -10.0, -60.0
    session.commit()

    summary = run()

    session.refresh(building)
    assert (building.latitude, building.longitude) == (-10.0, -60.0)
    assert summary.filled == 0
    assert cep_requests == []


def test_main_prints_the_summary(
    session: Session, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
):
    farmer = farmer_with_cep(session, "a@example.com", "99999999")
    add_building(session, add_user(session, "s@example.com"))
    client, _ = fake_client(by_cep)
    monkeypatch.setattr(script, "engine", engine_test)
    monkeypatch.setattr(script.httpx, "Client", lambda: client)

    script.main()

    out = capsys.readouterr().out
    assert "Perfis preenchidos: 1" in out
    assert "Perfis sem coordenadas: 1" in out
    assert f"agricultor {farmer.public_id}, CEP 99999999: CepNotFoundError" in out
