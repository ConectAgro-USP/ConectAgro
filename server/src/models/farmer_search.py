from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from src.models.pagination import PaginatedResponse
from src.models.product import Product

AllowedDistance = Literal[5, 10, 15]


class FarmerSearchItem(BaseModel):
    public_id: UUID
    name: str
    zip_code: str
    average_rating: float | None = None
    reviews_count: int = 0
    on_time_delivery_percentage: float | None = None
    distance_km: float | None = None
    products: list[Product] = Field(default_factory=list)


class FarmerSearchFilters(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    products: list[str] | None = None
    origin_cep: str | None = None
    max_distance_km: int | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator("name")
    @classmethod
    def strip_query(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


FarmerSearchResponse = PaginatedResponse[FarmerSearchItem]