from sqlmodel import Session

from src.models.product_search import ProductSearchFilters, ProductSearchPage
from src.services.exceptions import ProductSearchNotImplementedError


class ProductRepository:
    def __init__(self, session: Session):
        self.session = session

    def search(self, filters: ProductSearchFilters) -> ProductSearchPage:
        raise ProductSearchNotImplementedError
