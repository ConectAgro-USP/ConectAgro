from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import event
from sqlmodel import Field, Relationship, SQLModel

from src.core.search_text import fold

if TYPE_CHECKING:
    from .buyer import Buyer
    from .purchase import Purchase
    from .user import User


class Apartment(SQLModel, table=True):
    __tablename__ = "apartments"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)

    zip_code: str
    # None nos cadastros anteriores às coordenadas, que a busca por distância preenche
    latitude: float | None = None
    longitude: float | None = None
    building_name: str
    # preenchida pelo evento abaixo, para a busca por nome ignorar acentos
    building_name_search: str = Field(default="", index=True)
    # sem unique: quem cadastrasse o CNPJ antes trancaria o síndico de verdade
    building_cnpj: str = Field(index=True)
    # None nos prédios antigos e quando a CNPJá não traz o endereço
    address: str | None = None

    manager_id: int = Field(foreign_key="users.id", unique=True)

    manager: "User" = Relationship(back_populates="apartment")
    buyers: list["Buyer"] = Relationship(back_populates="apartment")
    purchases: list["Purchase"] = Relationship(back_populates="apartment")


@event.listens_for(Apartment, "before_insert")
@event.listens_for(Apartment, "before_update")
def fold_building_name(_mapper, _connection, apartment: Apartment) -> None:
    apartment.building_name_search = fold(apartment.building_name)
