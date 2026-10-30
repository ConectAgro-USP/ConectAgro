from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .apartment import Apartment
    from .interest import Interest
    from .user import User

class LinkStatus(StrEnum):
    PENDENTE = "PENDENTE"
    APROVADO = "APROVADO"
    RECUSADO = "RECUSADO"

class Buyer(SQLModel, table=True):
    __tablename__ = "buyers"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)

    apartment_id: int | None = Field(
        default=None,
        foreign_key="apartments.id",
    )

    user_id: int = Field(foreign_key="users.id", unique=True)

    block: str | None = None
    unit: str = Field(min_length=1, max_length=10)
    link_status: LinkStatus = Field(default=LinkStatus.PENDENTE)
    link_reviewed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    user: "User" = Relationship(back_populates="buyer")
    apartment: Optional["Apartment"] = Relationship(back_populates="buyers")
    interests: list["Interest"] = Relationship(back_populates="buyer", cascade_delete=True)
