from uuid import UUID

from sqlmodel import Field, Relationship
from typing import Optional

from .user import UserBase


class Buyer(UserBase, table=True):
    __tablename__ = "buyers"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(unique=True, index=True)

    apartment_id: int | None = Field(
        default=None,
        foreign_key="apartments.id",
    )

    apartment: Optional["Apartment"] = Relationship(back_populates="buyers")
