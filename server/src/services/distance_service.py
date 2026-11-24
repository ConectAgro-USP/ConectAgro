from math import asin, cos, degrees, radians, sin

from haversine import haversine

from src.connectors.brasilapi import BrasilApiConnector
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.farmer_search import BoundingBox
from src.services.exceptions import (
    BuildingWithoutCoordinatesError,
    CepNotFoundError,
    InvalidCepError,
)

# o mesmo raio médio da Terra que a biblioteca haversine usa
EARTH_RADIUS_KM = 6371.0088

Point = tuple[float, float]


class DistanceService:
    def __init__(self, ceps: BrasilApiConnector):
        self.ceps = ceps

    def look_up_building(self, building: Apartment) -> Point:
        # prédio anterior às coordenadas, uma única consulta ao CEP
        try:
            address = self.ceps.get_address(building.zip_code)
        except (CepNotFoundError, InvalidCepError):
            raise BuildingWithoutCoordinatesError(building.zip_code) from None
        if address.coordinates is None:
            raise BuildingWithoutCoordinatesError(building.zip_code)
        building.latitude = address.coordinates.latitude
        building.longitude = address.coordinates.longitude
        return building.latitude, building.longitude


def saved_point(profile: Apartment | Farmer) -> Point | None:
    if profile.latitude is None or profile.longitude is None:
        return None
    return profile.latitude, profile.longitude


def km_between(origin: Point, destination: Point) -> float:
    # em linha reta, e a BrasilAPI costuma dar o centro da cidade
    return haversine(origin, destination)


def bounding_box(center: Point, radius_km: float) -> BoundingBox:
    # a menor caixa que contém o círculo, para o SQL descartar os distantes
    latitude, longitude = center
    angle = radius_km / EARTH_RADIUS_KM
    latitude_delta = degrees(angle)
    reach = sin(angle) / cos(radians(latitude)) if abs(latitude) < 90 else 1.0
    longitude_delta = degrees(asin(reach)) if reach < 1 else 180.0
    return BoundingBox(
        min_latitude=latitude - latitude_delta,
        max_latitude=latitude + latitude_delta,
        min_longitude=longitude - longitude_delta,
        max_longitude=longitude + longitude_delta,
    )
