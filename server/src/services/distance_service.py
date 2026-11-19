from haversine import haversine

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.models import Address, Coordinates
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.services.exceptions import CepWithoutCoordinatesError


class DistanceService:
    def __init__(self, ceps: BrasilApiConnector):
        self.ceps = ceps

    def km_between(self, origin: Apartment | Farmer, destination: Apartment | Farmer) -> float:
        # em linha reta, e para muitos CEPs a BrasilAPI dá o centro da cidade, não a rua
        return round(haversine(self._point(origin), self._point(destination)), 2)

    def _point(self, profile: Apartment | Farmer) -> tuple[float, float]:
        if profile.latitude is None or profile.longitude is None:
            # cadastro anterior às coordenadas: a busca consulta o CEP e as salva, sem conferir
            # se ele mudou nesse meio-tempo, risco que só existe até os antigos serem salvos
            coordinates = _require_coordinates(self.ceps.get_address(profile.zip_code))
            profile.latitude = coordinates.latitude
            profile.longitude = coordinates.longitude
        return profile.latitude, profile.longitude


def _require_coordinates(address: Address) -> Coordinates:
    if address.coordinates is None:
        raise CepWithoutCoordinatesError(address.cep)
    return address.coordinates
