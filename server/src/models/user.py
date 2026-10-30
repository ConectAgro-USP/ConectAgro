from datetime import UTC, datetime
from typing import TYPE_CHECKING, Annotated, Optional

from pydantic import AfterValidator, EmailStr, StringConstraints
from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel

from src.services.phone_service import validate_cellphone, validate_homephone

NormalizedEmail = Annotated[EmailStr, AfterValidator(str.lower)]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
CellPhone = Annotated[str, AfterValidator(validate_cellphone)]
HomePhone = Annotated[str, AfterValidator(validate_homephone)]

if TYPE_CHECKING:
    from .apartment import Apartment
    from .buyer import Buyer
    from .farmer import Farmer

class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    name: str
    picture_url: str | None = None
    cellphone: CellPhone | None = None
    homephone: HomePhone | None = None


class User(UserBase, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    hashed_password: str | None = None

    farmer: Optional["Farmer"] = Relationship(back_populates="user")
    apartment: Optional["Apartment"] = Relationship(back_populates="manager")
    buyer: Optional["Buyer"] = Relationship(back_populates="user")


class UserRead(UserBase):
    id: int
    created_at: datetime


class UserCreate(SQLModel):
    name: PersonName
    email: NormalizedEmail
    password: str = Field(min_length=8, max_length=128)


class UserLogin(SQLModel):
    email: NormalizedEmail
    password: str = Field(max_length=128)
