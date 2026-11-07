from src.repository.product_repository import ProductRepository
from src.schemas.pagination import PaginatedResponse
from src.schemas.product_search import (
    PRODUCTS_PER_PAGE,
    ProductSearchFilters,
    ProductSearchItem,
    ProductSearchResponse,
)


class ProductSearchService:
    def __init__(self, products: ProductRepository):
        self.products = products

    def search(self, filters: ProductSearchFilters) -> ProductSearchResponse:
        products, total = self.products.search(filters)
        items = [
            ProductSearchItem.model_validate(product, from_attributes=True)
            for product in products
        ]
        return PaginatedResponse[ProductSearchItem].from_page(
            items, filters.page, PRODUCTS_PER_PAGE, total
        )
