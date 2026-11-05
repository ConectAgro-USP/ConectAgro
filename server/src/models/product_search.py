from datetime import date
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from src.models.product import ProductRead

PRODUCTS_PER_PAGE = 20


class ProductSort(StrEnum):
    RELEVANCE = "relevance"
    LOWEST_PRICE = "lowest_price"
    LATEST_EXPIRATION = "latest_expiration"
    HIGHEST_RATING = "highest_rating"


class ProductSearchFilters(BaseModel):
    q: str | None = None
    expiration_from: date | None = None
    min_quantity: int | None = Field(default=None, ge=1)
    sort: ProductSort = ProductSort.RELEVANCE
    page: int = Field(default=1, ge=1)


class ProductSearchPage(BaseModel):
    items: list[ProductRead]
    page: int
    per_page: Literal[20] = PRODUCTS_PER_PAGE
    total: int
