from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from src.schemas.pagination import PaginatedResponse

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
    page: int = Field(default=1, ge=1)

    @field_validator("q")
    @classmethod
    def strip_query(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ProductSearchItem(BaseModel):
    public_id: UUID
    name: str
    description: str | None = None
    picture_url: str | None = None
    quantity: int
    price: Decimal
    expiration_date: date
    created_at: datetime
    farmer_public_id: UUID


ProductSearchResponse = PaginatedResponse[ProductSearchItem]
