from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    name: str
    picture_url: str | None = None


class User(UserBase, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    hashed_password: str


class UserRead(UserBase):
    id: int
    created_at: datetime


class UserCreate(SQLModel):
    name: str
    email: str
    password: str
    address: str | None = None


class UserLogin(SQLModel):
    email: str
    password: str