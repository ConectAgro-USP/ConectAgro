from unittest.mock import NonCallableMagicMock, call, create_autospec

import pytest

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.models import Address, Coordinates, Route
from src.connectors.osrm import OsrmConnector
from src.services.distance_service import CepDistance, DistanceService
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
ROUTE = Route(distance_m=1015234.5, duration_s=43210.7)


def fake_service(
    *answers: Address | Exception,
) -> tuple[DistanceService, NonCallableMagicMock, NonCallableMagicMock]:
    ceps = create_autospec(BrasilApiConnector, instance=True)
    ceps.get_address.side_effect = answers
    routes = create_autospec(OsrmConnector, instance=True)
    routes.get_route.return_value = ROUTE
    return DistanceService(ceps, routes), ceps, routes


def test_between_ceps_returns_both_addresses_and_the_route():
    service, ceps, routes = fake_service(PRACA_DA_SE, BRASILIA)

    distance = service.between_ceps("01001-000", "70040-010")

    assert distance == CepDistance(origin=PRACA_DA_SE, destination=BRASILIA, **ROUTE.model_dump())
    ceps.get_address.assert_has_calls([call("01001-000"), call("70040-010")])
    routes.get_route.assert_called_once_with(PRACA_DA_SE.coordinates, BRASILIA.coordinates)


@pytest.mark.parametrize(("missing", "lookups"), [(0, 1), (1, 2)], ids=["origem", "destino"])
def test_between_ceps_stops_at_the_first_cep_without_coordinates(missing: int, lookups: int):
    addresses = [PRACA_DA_SE, BRASILIA]
    addresses[missing] = addresses[missing].model_copy(update={"coordinates": None})
    service, ceps, routes = fake_service(*addresses)

    with pytest.raises(CepWithoutCoordinatesError) as caught:
        service.between_ceps(PRACA_DA_SE.cep, BRASILIA.cep)

    assert str(caught.value) == addresses[missing].cep
    assert ceps.get_address.call_count == lookups
    routes.get_route.assert_not_called()


def test_between_ceps_propagates_cep_not_found():
    service, _, _ = fake_service(PRACA_DA_SE, CepNotFoundError("70040010"))

    with pytest.raises(CepNotFoundError):
        service.between_ceps(PRACA_DA_SE.cep, BRASILIA.cep)
