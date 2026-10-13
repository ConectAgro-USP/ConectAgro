from uuid import UUID

from pydantic import ConfigDict
from sqlmodel import Field, Relationship

from src.utils.validate_phone import CellPhone, HomePhone

from .user import UserBase


class Apartment(UserBase, table=True):
    __tablename__ = "apartments"
    model_config = ConfigDict(validate_assignment=True)

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(unique=True, index=True)
    cellphone: CellPhone
    homephone: HomePhone | None = None
    zip_code: str
    building_manager_id: str
    building_tax_id: str

    buyers: list["Buyer"] = Relationship(back_populates="apartment")

    def change_manager(self, new_manager: str) -> None:
        self.building_manager_id = new_manager
