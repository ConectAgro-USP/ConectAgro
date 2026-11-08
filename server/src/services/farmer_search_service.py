from src.models.farmer import Farmer
from src.repository.farmer_search_repository import FarmerSearchRepository
from src.schemas.farmer_search import FarmerSearchFilters, FarmerSearchItem, FarmerSearchResponse
from src.services.distance_service import DistanceService
from src.services.exceptions import InvalidDistanceError, MissingOriginCepError


class FarmerSearchService:
    def __init__(self, repository: FarmerSearchRepository, 
                 distance_service: DistanceService | None = None
    ):
        self.repository = repository
        self.distance_service = distance_service


    def search(self, filters: FarmerSearchFilters) -> FarmerSearchResponse:
        self.validate_filters(filters)
        farmers = self.repository.search(filters.name, filters.products)
        
        farmers, distances = self._filter_by_distance(
                                farmers, 
                                filters.origin_cep, 
                                filters.max_distance_km
                            )
        
        if not farmers:
            return FarmerSearchResponse.paginate([], filters.page, filters.page_size)

        farmer_ids = [farmer.id for farmer in farmers if farmer.id is not None]

        items = self.create_farmer_pages(
            farmers=farmers,
            distances=distances,
            reviews=self.repository.get_review_summaries_by_id(farmer_ids),
            delivery_rates=self._get_on_time_delivery_rates(farmer_ids)
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
        reviews: dict[int, tuple[float | None, int]],
        delivery_rates: dict[int, float | None],
    ) -> list[FarmerSearchItem]:
        
        items: list[FarmerSearchItem] = []

        for farmer in farmers:
            farmer_id = farmer.id or 0
            avg_rating, reviews_count = reviews.get(farmer_id, (None, 0))

            farmer_search_item = FarmerSearchItem(
                    public_id=farmer.public_id,
                    name=farmer.user.name,
                    zip_code=farmer.zip_code,
                    average_rating=avg_rating,
                    reviews_count=reviews_count,
                    on_time_delivery_percentage=delivery_rates.get(farmer_id),
                    distance_km=distances.get(farmer_id),
                    products=farmer.products
                )
            items.append(farmer_search_item)

        return items


    def _filter_by_distance(
        self,
        farmers: list[Farmer],
        origin_cep: str | None,
        max_distance_km: int | None,
    ) -> tuple[list[Farmer], dict[int, float]]:
        
        if max_distance_km is None:
            return farmers, {}
        if self.distance_service is None:
            raise RuntimeError("O serviço de distância não está disponível")
        if not origin_cep:
            raise MissingOriginCepError(
                "O CEP de origem é obrigatório ao filtrar por distância"
            )

        close_farmers: list[Farmer] = []
        farmer_distances: dict[int, float] = {}

        for farmer in farmers:
            route = self.distance_service.between_ceps(origin_cep, farmer.zip_code)
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


    def _sort_by_reputation(self, items: list[FarmerSearchItem]) -> list[FarmerSearchItem]:
        return sorted(items, key=self.reputation_key)


    """Ordenação por avaliação, entregas no prazo, qauntidade de reviews e nome."""
    @staticmethod
    def reputation_key(farmer: FarmerSearchItem) -> tuple[float, float, int, str]:
        rating = farmer.average_rating or 0.0
        delivery_rate = farmer.on_time_delivery_percentage or 0.0

        return (rating, delivery_rate, farmer.reviews_count, farmer.name.lower())

    def validate_filters(
        self,
        filters: FarmerSearchFilters
    ) -> None:
        if filters.page < 1:
            raise ValueError("O número da página deve ser maior ou igual a 1")
        if filters.page_size < 1:
            raise ValueError("O tamanho da página deve ser maior ou igual a 1")

        if filters.max_distance_km is None:
            return
        if filters.max_distance_km not in (5, 10, 15):
            raise InvalidDistanceError("A distância máxima deve ser 5, 10 ou 15 km")
        if not filters.origin_cep or not filters.origin_cep.strip():
            raise MissingOriginCepError(
                "O CEP de origem é obrigatório ao filtrar por distância"
            )