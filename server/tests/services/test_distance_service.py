from unittest.mock import NonCallableMagicMock, create_autospec

import pytest

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.models import Address, Coordinates
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.services.distance_service import DistanceService, km_between, saved_point
from src.services.exceptions import BuildingWithoutCoordinatesError, CepNotFoundError

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


def test_km_between_uses_the_saved_coordinates():
    building = Apartment(zip_code="01001-000", **PRACA_DA_SE.coordinates.model_dump())
    farmer = Farmer(zip_code="70040-010", **BRASILIA.coordinates.model_dump())

    distance = km_between(saved_point(building), saved_point(farmer))

    assert round(distance, 2) == PRACA_DA_SE_TO_BRASILIA_KM


def test_saved_point_is_none_for_old_profiles():
    assert saved_point(Farmer(zip_code="70040-010")) is None


def test_look_up_building_keeps_the_coordinates():
    service, ceps = fake_service(PRACA_DA_SE)
    building = Apartment(zip_code="01001-000")

    assert service.look_up_building(building) == (-23.5503898, -46.633081)
    ceps.get_address.assert_called_once_with("01001-000")
    assert (building.latitude, building.longitude) == (-23.5503898, -46.633081)


def test_look_up_building_rejects_a_cep_without_coordinates():
    service, _ = fake_service(PRACA_DA_SE.model_copy(update={"coordinates": None}))
    building = Apartment(zip_code="01001-000")

    with pytest.raises(BuildingWithoutCoordinatesError):
        service.look_up_building(building)

    assert building.latitude is None


def test_look_up_building_rejects_a_cep_not_found():
    service, _ = fake_service(CepNotFoundError("01001000"))

    with pytest.raises(BuildingWithoutCoordinatesError):
        service.look_up_building(Apartment(zip_code="01001-000"))
