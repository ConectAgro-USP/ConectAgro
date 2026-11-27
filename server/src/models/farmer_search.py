from enum import IntEnum, StrEnum
from typing import Annotated, NamedTuple

from pydantic import Field, field_validator

from src.core.text import reject_null_character
from src.models.farmer import FarmerSearchRead
from src.models.pagination import PageParams, PaginatedResponse


class AllowedDistance(IntEnum):
    FIVE = 5
    TEN = 10
    FIFTEEN = 15


class FarmerSort(StrEnum):
    REPUTATION = "reputation"
    DISTANCE = "distance"


class BoundingBox(NamedTuple):
    min_latitude: float
    max_latitude: float
    min_longitude: float
    max_longitude: float


class FarmerSearchFilters(PageParams):
    name: str | None = Field(default=None, max_length=200)
    products: list[Annotated[str, Field(max_length=200)]] = Field(
        default_factory=list, max_length=10
    )
    max_distance_km: AllowedDistance | None = None
    sort: FarmerSort = FarmerSort.REPUTATION

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
