from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

AllowedDistance = Literal[5, 10, 15]


class FarmerSearchItem(BaseModel):
    public_id: UUID
    name: str
    zip_code: str
    picture_url: str | None = None
    cellphone: str | None = None
    homephone: str | None = None
    average_rating: float | None = None
    reviews_count: int = 0
    on_time_delivery_percentage: float | None = None
    distance_km: float | None = None
    products: list[str] = Field(default_factory=list)


