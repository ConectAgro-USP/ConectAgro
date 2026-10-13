from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from pydantic import ConfigDict
from sqlmodel import Field, Relationship

from src.utils.validate_phone import CellPhone, HomePhone

from .user import UserBase

if TYPE_CHECKING:
    from .product import Product


class Farmer(UserBase, table=True):
    __tablename__ = "farmers"
    model_config = ConfigDict(validate_assignment=True)

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)
    cellphone: CellPhone
    homephone: HomePhone | None = None
    zip_code: str

    products: list["Product"] = Relationship(back_populates="farmer")
