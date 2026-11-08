
from src.connectors.exceptions import CepNotFoundError
from src.models.farmer import FarmerSearchResponse
from src.repository.profile_repository import ProfileRepository
from src.services.distance_service import DistanceService
from src.services.exceptions import CepWithoutCoordinatesError


class FarmerSearchService:
    def __init__(self, profile_repository: ProfileRepository, distance_service: DistanceService):
        self.profile_repository = profile_repository
        self.distance_service = distance_service

    def search_nearby_farmers(self,
                               building_cep: str, 
                               max_distance_km: float,
                               ) -> list[FarmerSearchResponse]:
        farmers_with_counts = self.profile_repository.get_farmers_with_products_count()

        nearby_farmers: list[FarmerSearchResponse] = []

        for farmer, products_count in farmers_with_counts:
            if not farmer.zip_code:
                continue
            try:
                cep_distance = self.distance_service.between_ceps(
                origin_cep=building_cep,
                destination_cep=farmer.zip_code
            )
            except (CepWithoutCoordinatesError, CepNotFoundError):
                continue

            # Filtra pelo raio
            distance_km = round(cep_distance.distance_m / 1000.0, 2)
            if distance_km <= max_distance_km:
                nearby_farmers.append(
                    FarmerSearchResponse(
                        name=farmer.user.name,
                        cep=farmer.zip_code,
                        distance_km=distance_km,
                        available_products_count=products_count
                    )
                )

        # Ordena pelas distancias em ordem crescente
        nearby_farmers.sort(key=lambda item: item.distance_km)

        return nearby_farmers