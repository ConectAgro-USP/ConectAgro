from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, EmailStr, StringConstraints
from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel

from src.utils.validate_phone import validate_cellphone, validate_homephone

NormalizedEmail = Annotated[EmailStr, AfterValidator(str.lower)]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
CellPhone = Annotated[str, BeforeValidator(validate_cellphone)]
HomePhone = Annotated[str, BeforeValidator(validate_homephone)]


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
