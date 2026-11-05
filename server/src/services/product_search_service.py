from src.models.product_search import ProductSearchFilters, ProductSearchPage
from src.repository.product_repository import ProductRepository


class ProductSearchService:
    def __init__(self, products: ProductRepository):
        self.products = products

    def search(self, filters: ProductSearchFilters) -> ProductSearchPage:
        return self.products.search(filters)
