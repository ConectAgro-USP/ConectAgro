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


class UserRead(UserBase):
    id: int
    created_at: datetime
