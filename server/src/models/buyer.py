from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship

from .user import UserBase

if TYPE_CHECKING:
    from .apartment import Apartment
    from .interest import Interest


class Buyer(UserBase, table=True):
    __tablename__ = "buyers"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)

    apartment_id: int | None = Field(
        default=None,
        foreign_key="apartments.id",
    )

    apartment: Optional["Apartment"] = Relationship(back_populates="buyers")
    interests: list["Interest"] = Relationship(back_populates="buyer", cascade_delete=True)
