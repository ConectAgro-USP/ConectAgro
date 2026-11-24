from datetime import datetime

from src.core.search_text import fold
from src.models.product import BUSINESS_TZ, ProductCatalogRead
from src.models.product_search import (
    PRODUCTS_PER_PAGE,
    ProductSearchFilters,
    ProductSearchResponse,
)
from src.repository.product_repository import ProductRepository
from src.services.text_service import short_name


class ProductSearchService:
    def __init__(self, products: ProductRepository):
        self.products = products

    def search(self, filters: ProductSearchFilters) -> ProductSearchResponse:
        today = datetime.now(BUSINESS_TZ).date()
        # o texto buscado é comparado com as cópias sem acentos do produto
        query = fold(filters.q) or None
        products, total = self.products.search(filters.model_copy(update={"q": query}), today)
        items = []
        for product, average, count in products:
            farmer_summary = {
                "farmer_short_name": short_name(product.farmer.user.name),
                "farmer_farm_name": product.farmer.farm_name,
                "farmer_average_rating": None if average is None else round(float(average), 2),
                "farmer_reviews_count": count or 0,
            }
            items.append(ProductCatalogRead.model_validate(product, update=farmer_summary))
        return ProductSearchResponse.from_page(items, filters.page, PRODUCTS_PER_PAGE, total)
