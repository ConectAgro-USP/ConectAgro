from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.models import Address, Coordinates, Route
from src.connectors.osrm import OsrmConnector
from src.services.exceptions import CepWithoutCoordinatesError


class CepDistance(Route):
    origin: Address
    destination: Address


class DistanceService:
    def __init__(self, ceps: BrasilApiConnector, routes: OsrmConnector):
        self.ceps = ceps
        self.routes = routes

    def between_ceps(self, origin_cep: str, destination_cep: str) -> CepDistance:
        origin = self.ceps.get_address(origin_cep)
        start = _require_coordinates(origin)
        destination = self.ceps.get_address(destination_cep)
        # para muitos CEPs a BrasilAPI dá o centro da cidade, não a rua
        route = self.routes.get_route(start, _require_coordinates(destination))
        return CepDistance(origin=origin, destination=destination, **route.model_dump())


def _require_coordinates(address: Address) -> Coordinates:
    if address.coordinates is None:
        raise CepWithoutCoordinatesError(address.cep)
    return address.coordinates
