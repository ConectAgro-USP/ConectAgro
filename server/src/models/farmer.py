from typing import TYPE_CHECKING
from uuid import UUID

from sqlmodel import Field, Relationship

from .user import UserBase

if TYPE_CHECKING:
    from .product import Product


class Farmer(UserBase, table=True):
    __tablename__ = "farmers"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(unique=True, index=True)
    zip_code: str

    products: list["Product"] = Relationship(back_populates="farmer")
