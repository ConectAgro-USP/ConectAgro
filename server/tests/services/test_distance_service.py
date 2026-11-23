from unittest.mock import NonCallableMagicMock, call, create_autospec

import pytest

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.models import Address, Coordinates
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.services.distance_service import DistanceService
from src.services.exceptions import CepNotFoundError, CepWithoutCoordinatesError

PRACA_DA_SE = Address(
    cep="01001000",
    state="SP",
    city="São Paulo",
    coordinates=Coordinates(latitude=-23.5503898, longitude=-46.633081),
)
BRASILIA = Address(
    cep="70040010",
    state="DF",
    city="Brasília",
    coordinates=Coordinates(latitude=-15.77972, longitude=-47.92972),
)
# em linha reta entre os dois pontos acima
PRACA_DA_SE_TO_BRASILIA_KM = 874.64


def fake_service(*answers: Address | Exception) -> tuple[DistanceService, NonCallableMagicMock]:
    ceps = create_autospec(BrasilApiConnector, instance=True)
    ceps.get_address.side_effect = answers
    return DistanceService(ceps), ceps


def old_profiles() -> tuple[Apartment, Farmer]:
    # cadastrados antes de as coordenadas serem salvas
    return Apartment(zip_code="01001-000"), Farmer(zip_code="70040-010")


def test_km_between_uses_the_saved_coordinates_without_the_brasilapi():
    service, ceps = fake_service()
    building = Apartment(zip_code="01001-000", **PRACA_DA_SE.coordinates.model_dump())
    farmer = Farmer(zip_code="70040-010", **BRASILIA.coordinates.model_dump())

    assert service.km_between(building, farmer) == PRACA_DA_SE_TO_BRASILIA_KM
    ceps.get_address.assert_not_called()


def test_km_between_looks_up_and_keeps_the_coordinates_of_old_profiles():
    service, ceps = fake_service(PRACA_DA_SE, BRASILIA)
    building, farmer = old_profiles()

    assert service.km_between(building, farmer) == PRACA_DA_SE_TO_BRASILIA_KM
    ceps.get_address.assert_has_calls([call("01001-000"), call("70040-010")])
    assert (building.latitude, building.longitude) == (-23.5503898, -46.633081)
    assert (farmer.latitude, farmer.longitude) == (-15.77972, -47.92972)


@pytest.mark.parametrize(("missing", "lookups"), [(0, 1), (1, 2)], ids=["origem", "destino"])
def test_km_between_stops_at_the_first_cep_without_coordinates(missing: int, lookups: int):
    addresses = [PRACA_DA_SE, BRASILIA]
    addresses[missing] = addresses[missing].model_copy(update={"coordinates": None})
    service, ceps = fake_service(*addresses)
    profiles = old_profiles()

    with pytest.raises(CepWithoutCoordinatesError) as caught:
        service.km_between(*profiles)

    assert str(caught.value) == addresses[missing].cep
    assert ceps.get_address.call_count == lookups
    assert profiles[missing].latitude is None


def test_km_between_propagates_cep_not_found():
    service, _ = fake_service(PRACA_DA_SE, CepNotFoundError("70040010"))
    profiles = old_profiles()

    with pytest.raises(CepNotFoundError):
        service.km_between(*profiles)
