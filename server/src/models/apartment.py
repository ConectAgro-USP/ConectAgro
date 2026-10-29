from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .buyer import Buyer
    from .purchase import Purchase
    from .user import User


class Apartment(SQLModel, table=True):
    __tablename__ = "apartments"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)

    zip_code: str
    building_name: str
    building_cnpj: str

    manager_id: int = Field(foreign_key="users.id", unique=True)
    
    manager: "User" = Relationship(back_populates="apartment")
    buyers: list["Buyer"] = Relationship(back_populates="apartment")
    purchases: list["Purchase"] = Relationship(back_populates="apartment")

    def change_manager(self, new_manager: int) -> None:
        self.manager_id = new_manager
