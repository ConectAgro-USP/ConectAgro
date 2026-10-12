from uuid import UUID

from pydantic import ConfigDict
from sqlmodel import Field

from src.utils.validate_phone import Phone

from .user import UserBase


class Farmer(UserBase, table=True):
    __tablename__ = "farmers"
    model_config = ConfigDict(validate_assignment=True)

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(unique=True, index=True)
    phone: Phone
    zip_code: str