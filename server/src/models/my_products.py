from enum import StrEnum

from pydantic import BaseModel

from src.models.pagination import PageParams, PaginatedResponse
from src.models.product import ProductRead

# o mesmo prazo que a página inicial do agricultor destaca
EXPIRING_SOON_DAYS = 7


class ProductAvailability(StrEnum):
    AVAILABLE = "available"
    HIDDEN = "hidden"


class MyProductsFilters(PageParams):
    availability: ProductAvailability | None = None


class MyProductCounts(BaseModel):
    all: int
    available: int
    hidden: int
    sold_out: int
    expiring_soon: int


class MyProductsPage(PaginatedResponse[ProductRead]):
    # contam todos os produtos, seja qual for a página ou o filtro
    counts: MyProductCounts
