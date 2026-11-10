from datetime import datetime

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
        products, total = self.products.search(filters, today)
        items = []
        for product in products:
            farmer_short_name = short_name(product.farmer.user.name)
            items.append(
                ProductCatalogRead.model_validate(
                    product, update={"farmer_short_name": farmer_short_name}
                )
            )
        return ProductSearchResponse.from_page(items, filters.page, PRODUCTS_PER_PAGE, total)
