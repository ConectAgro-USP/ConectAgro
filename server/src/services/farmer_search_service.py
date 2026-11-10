from datetime import datetime

from src.models.farmer import Farmer, FarmerSearchRead
from src.models.farmer_search import FarmerSearchFilters, FarmerSearchResponse
from src.models.product import BUSINESS_TZ
from src.repository.farmer_search_repository import FarmerSearchRepository
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
    def __init__(
        self, repository: FarmerSearchRepository, distance_service: DistanceService | None = None
    ):
        self.repository = repository
        self.distance_service = distance_service

    def search(self, filters: FarmerSearchFilters, building_cep: str) -> FarmerSearchResponse:
        today = datetime.now(BUSINESS_TZ).date()
        farmers = self.repository.search(filters.name, filters.products, today)

        farmers, distances = self._filter_by_distance(
            farmers, building_cep, filters.max_distance_km
        )

        farmer_ids = [farmer.id for farmer in farmers]

        items = self.create_farmer_pages(
            farmers=farmers,
            distances=distances,
            products_counts=self.repository.get_available_products_counts_by_id(farmer_ids, today),
            reviews=self.repository.get_review_summaries_by_id(farmer_ids),
            delivery_rates=self._get_on_time_delivery_rates(farmer_ids),
        )

        return FarmerSearchResponse.paginate(
            self._sort_by_reputation(items),
            filters.page,
            filters.page_size,
        )

    def create_farmer_pages(
        self,
        farmers: list[Farmer],
        distances: dict[int, float],
        products_counts: dict[int, int],
        reviews: dict[int, tuple[float, int]],
        delivery_rates: dict[int, float | None],
    ) -> list[FarmerSearchRead]:
        items: list[FarmerSearchRead] = []

        for farmer in farmers:
            avg_rating, reviews_count = reviews.get(farmer.id, (None, 0))

            farmer_search_item = FarmerSearchRead(
                public_id=farmer.public_id,
                name=short_name(farmer.user.name),
                farm_name=farmer.farm_name,
                zip_code=farmer.zip_code,
                distance_km=distances.get(farmer.id),
                available_products_count=products_counts.get(farmer.id, 0),
                average_rating=avg_rating,
                reviews_count=reviews_count,
                on_time_delivery_percentage=delivery_rates.get(farmer.id),
            )
            items.append(farmer_search_item)

        return items

    def _filter_by_distance(
        self,
        farmers: list[Farmer],
        building_cep: str,
        max_distance_km: int | None,
    ) -> tuple[list[Farmer], dict[int, float]]:
        if max_distance_km is None:
            return farmers, {}
        if self.distance_service is None:
            raise RuntimeError("O serviço de distância não está disponível")

        close_farmers: list[Farmer] = []
        farmer_distances: dict[int, float] = {}

        for farmer in farmers:
            try:
                route = self.distance_service.between_ceps(building_cep, farmer.zip_code)
            except SKIPPED_CEP_ERRORS:
                continue
            # Filtra pelo raio
            distance_km = round(route.distance_m / 1000.0, 2)
            if distance_km <= max_distance_km:
                farmer_distances[farmer.id] = distance_km
                close_farmers.append(farmer)

        return close_farmers, farmer_distances

    def _get_on_time_delivery_rates(
        self,
        farmer_ids: list[int],
    ) -> dict[int, float | None]:
        delivery_counts = self.repository.get_delivery_counts_by_id(farmer_ids)
        return {
            farmer_id: self.delivery_rate(on_time, delivered)
            for farmer_id, (on_time, delivered) in delivery_counts.items()
        }

    @staticmethod
    def delivery_rate(on_time: int, total_delivered: int) -> float | None:
        return round((on_time / total_delivered) * 100.0, 1) if (total_delivered > 0) else None

    def _sort_by_reputation(self, items: list[FarmerSearchRead]) -> list[FarmerSearchRead]:
        return sorted(items, key=self.reputation_key)

    """Ordenação por avaliação, entregas no prazo, distância, qauntidade de reviews e nome."""
    @staticmethod
    def reputation_key(farmer: FarmerSearchRead) -> tuple[float, float, float, int, str]:
        rating = farmer.average_rating or 0.0
        delivery_rate = farmer.on_time_delivery_percentage or 0.0
        distance = farmer.distance_km or 0.0

        # o sinal negativo põe os maiores valores na frente
        return (-rating, -delivery_rate, distance, -farmer.reviews_count, farmer.name.lower())
