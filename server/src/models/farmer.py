from uuid import UUID

from sqlmodel import Field

from .user import UserBase


class Farmer(UserBase, table=True):
    __tablename__ = "farmers"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(unique=True, index=True)
    zip_code: str
