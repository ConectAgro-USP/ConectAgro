from datetime import datetime

from src.models.farmer import FarmerSearchRead
from src.models.product import BUSINESS_TZ
from src.repository.profile_repository import ProfileRepository
from src.services.distance_service import DistanceService
from src.services.exceptions import (
    CepNotFoundError,
    CepWithoutCoordinatesError,
    InvalidCepError,
    RouteNotFoundError,
)
from src.services.text_service import short_name

# o agricultor com esses problemas no CEP fica de fora, sem derrubar a busca
SKIPPED_CEP_ERRORS = (
    CepNotFoundError,
    CepWithoutCoordinatesError,
    InvalidCepError,
    RouteNotFoundError,
)


class FarmerSearchService:
    def __init__(self, profiles: ProfileRepository, distance_service: DistanceService):
        self.profiles = profiles
        self.distance_service = distance_service

    def search_nearby_farmers(
        self, building_cep: str, max_distance_km: int
    ) -> list[FarmerSearchRead]:
        today = datetime.now(BUSINESS_TZ).date()
        farmers = self.profiles.list_farmers_with_available_products_count(today)
        nearby_farmers: list[FarmerSearchRead] = []
        for farmer, products_count in farmers:
            try:
                route = self.distance_service.between_ceps(building_cep, farmer.zip_code)
            except SKIPPED_CEP_ERRORS:
                continue
            # Filtra pelo raio
            distance_km = round(route.distance_m / 1000, 2)
            if distance_km > max_distance_km:
                continue
            nearby_farmers.append(
                FarmerSearchRead(
                    public_id=farmer.public_id,
                    name=short_name(farmer.user.name),
                    farm_name=farmer.farm_name,
                    zip_code=farmer.zip_code,
                    distance_km=distance_km,
                    available_products_count=products_count,
                )
            )
        # Ordena pelas distancias em ordem crescente
        nearby_farmers.sort(key=lambda result: result.distance_km)
        return nearby_farmers
