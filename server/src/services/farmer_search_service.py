from datetime import datetime

from src.core.search_text import fold
from src.models.apartment import Apartment
from src.models.farmer import Farmer, FarmerSearchRead
from src.models.farmer_search import FarmerSearchFilters, FarmerSearchResponse, FarmerSort
from src.models.product import BUSINESS_TZ
from src.repository.farmer_search_repository import FarmerSearchRepository
from src.services.distance_service import (
    DistanceService,
    Point,
    bounding_box,
    km_between,
    saved_point,
)
from src.services.text_service import short_name


class FarmerSearchService:
    def __init__(self, repository: FarmerSearchRepository, distance_service: DistanceService):
        self.repository = repository
        self.distance_service = distance_service

    def search(self, filters: FarmerSearchFilters, building: Apartment) -> FarmerSearchResponse:
        today = datetime.now(BUSINESS_TZ).date()
        radius = filters.max_distance_km
        if radius is not None or filters.sort == FarmerSort.DISTANCE:
            origin = self._locate(building)
        else:
            origin = saved_point(building)
        box = bounding_box(origin, radius) if radius is not None else None
        farmers = self.repository.search(filters.products, today, box)
        if filters.name:
            query = fold(filters.name)
            farmers = [farmer for farmer in farmers if self.matches_name(farmer, query)]

        distances = self._distances(origin, farmers)
        if radius is not None:
            farmers = [farmer for farmer in farmers if distances[farmer.id] <= radius]

        farmer_ids = [farmer.id for farmer in farmers]

        items = self.create_farmer_pages(
            farmers=farmers,
            distances=distances,
            products_counts=self.repository.get_available_products_counts_by_id(farmer_ids, today),
            reviews=self.repository.get_review_summaries_by_id(farmer_ids),
            delivery_rates=self._get_on_time_delivery_rates(farmer_ids),
        )

        return FarmerSearchResponse.paginate(
            self._sort(items, filters.sort),
            filters.page,
            filters.page_size,
        )

    def _locate(self, building: Apartment) -> Point:
        point = saved_point(building)
        if point is None:
            point = self.distance_service.look_up_building(building)
            # salva as coordenadas antes de carregar os agricultores
            self.repository.commit()
        return point

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

    @staticmethod
    def matches_name(farmer: Farmer, query: str) -> bool:
        # o email salvo como nome fica de fora, para a busca não revelar o endereço
        name = "" if "@" in farmer.user.name else farmer.user.name
        return query in fold(name) or query in fold(farmer.farm_name)

    @staticmethod
    def _distances(origin: Point | None, farmers: list[Farmer]) -> dict[int, float]:
        if origin is None:
            return {}
        distances: dict[int, float] = {}
        for farmer in farmers:
            point = saved_point(farmer)
            if point is not None:
                distances[farmer.id] = round(km_between(origin, point), 2)
        return distances

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

    def _sort(self, items: list[FarmerSearchRead], sort: FarmerSort) -> list[FarmerSearchRead]:
        if sort == FarmerSort.DISTANCE:
            return sorted(items, key=self.distance_key)
        return sorted(items, key=self.reputation_key)

    @classmethod
    def distance_key(cls, farmer: FarmerSearchRead) -> tuple:
        # quem não tem distância vai para o fim, e o empate segue a reputação
        distance = farmer.distance_km if farmer.distance_km is not None else float("inf")
        return (distance, *cls.reputation_key(farmer))

    @staticmethod
    def reputation_key(farmer: FarmerSearchRead) -> tuple[float, float, float, int, str]:
        rating = farmer.average_rating or 0.0
        delivery_rate = farmer.on_time_delivery_percentage or 0.0
        distance = farmer.distance_km if farmer.distance_km is not None else float("inf")

        # o sinal negativo põe os maiores valores na frente
        return (-rating, -delivery_rate, distance, -farmer.reviews_count, farmer.name.lower())
