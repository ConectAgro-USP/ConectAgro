from typing import TYPE_CHECKING
from uuid import UUID

from sqlmodel import Field, Relationship

from .user import UserBase

if TYPE_CHECKING:
    from .buyer import Buyer


class Apartment(UserBase, table=True):
    __tablename__ = "apartments"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(unique=True, index=True)

    zip_code: str
    building_manager_id: str
    building_tax_id: str

    buyers: list["Buyer"] = Relationship(back_populates="apartment")

    def change_manager(self, new_manager: str) -> None:
        self.building_manager_id = new_manager
