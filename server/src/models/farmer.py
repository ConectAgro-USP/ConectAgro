from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel

from src.core.text import short_name

if TYPE_CHECKING:
    from .product import Product
    from .purchase import PurchasePart
    from .user import User


class Farmer(SQLModel, table=True):
    __tablename__ = "farmers"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)
    zip_code: str
    # None nos cadastros antigos, que ficam fora da busca por raio
    latitude: float | None = None
    longitude: float | None = None
    # None só nos cadastros feitos antes de o nome ser pedido
    farm_name: str | None = None

    user_id: int = Field(foreign_key="users.id", unique=True)
    
    user: "User" = Relationship(back_populates="farmer")
    products: list["Product"] = Relationship(back_populates="farmer")
    purchase_parts: list["PurchasePart"] = Relationship(back_populates="farmer")

    @property
    def short_name(self) -> str:
        return short_name(self.user.name)


class FarmerSearchRead(SQLModel):
    public_id: UUID
    name: str
    farm_name: str | None
    zip_code: str
    # None quando o prédio ou o agricultor não tem coordenadas
    distance_km: float | None
    available_products_count: int
    average_rating: float | None
    reviews_count: int
    on_time_delivery_percentage: float | None
