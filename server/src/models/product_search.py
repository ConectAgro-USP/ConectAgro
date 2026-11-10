from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from src.models.pagination import PaginatedResponse
from src.models.product import INT4_MAX, ProductCatalogRead
from src.services.text_service import reject_null_character

PRODUCTS_PER_PAGE = 20


class ProductSort(StrEnum):
    RELEVANCE = "relevance"
    LOWEST_PRICE = "lowest_price"
    LATEST_EXPIRATION = "latest_expiration"
    HIGHEST_RATING = "highest_rating"


class ProductSearchFilters(BaseModel):
    q: str | None = Field(default=None, max_length=200)
    expiration_from: date | None = None
    min_quantity: int | None = Field(default=None, ge=1)
    sort: ProductSort = ProductSort.RELEVANCE
    page: int = Field(default=1, ge=1, le=INT4_MAX)

    @field_validator("q")
    @classmethod
    def strip_query(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = reject_null_character(value)
        return value.strip() or None


ProductSearchResponse = PaginatedResponse[ProductCatalogRead]
