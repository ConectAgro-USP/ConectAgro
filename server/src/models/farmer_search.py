from enum import IntEnum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from src.models.farmer import FarmerSearchRead
from src.models.pagination import PaginatedResponse
from src.models.product import INT4_MAX
from src.services.text_service import reject_null_character


class AllowedDistance(IntEnum):
    FIVE = 5
    TEN = 10
    FIFTEEN = 15


class FarmerSearchFilters(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    products: list[Annotated[str, Field(max_length=200)]] = Field(
        default_factory=list, max_length=10
    )
    max_distance_km: AllowedDistance | None = None
    page: int = Field(default=1, ge=1, le=INT4_MAX)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator("name")
    @classmethod
    def strip_query(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = reject_null_character(value)
        return value.strip() or None

    @field_validator("products")
    @classmethod
    def strip_products(cls, values: list[str]) -> list[str]:
        products = []
        for value in values:
            value = reject_null_character(value).strip()
            if value:
                products.append(value)
        return products


FarmerSearchResponse = PaginatedResponse[FarmerSearchRead]
