from src.models.product import ProductRead
from src.models.product_search import ProductSearchFilters, ProductSearchPage
from src.repository.product_repository import ProductRepository


class ProductSearchService:
    def __init__(self, products: ProductRepository):
        self.products = products

    def search(self, filters: ProductSearchFilters) -> ProductSearchPage:
        products, total = self.products.search(filters)
        return ProductSearchPage(
            items=[
                ProductRead.model_validate(product, from_attributes=True)
                for product in products
            ],
            page=filters.page,
            total=total,
        )
