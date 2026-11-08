from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .product import Product
    from .purchase import PurchasePart
    from .user import User


class Farmer(SQLModel, table=True):
    __tablename__ = "farmers"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)
    zip_code: str

    user_id: int = Field(foreign_key="users.id", unique=True)
    
    user: "User" = Relationship(back_populates="farmer")
    products: list["Product"] = Relationship(back_populates="farmer")
    purchase_parts: list["PurchasePart"] = Relationship(back_populates="farmer")

class FarmerSearchResponse(SQLModel):
    name: str = Field(..., min_length=2, max_length=100)
    cep: str
    distance_km: float = Field(..., ge=0)
    available_products_count: int = Field(..., ge=0)