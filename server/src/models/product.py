from datetime import UTC, date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from pydantic import field_validator
from sqlalchemy import CheckConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .farmer import Farmer


class ProductBase(SQLModel):
    name: str = Field(min_length=1)
    description: str | None = None
    picture_url: str | None = None
    quantity: int = Field(ge=0)
    price: Decimal = Field(ge=0, max_digits=8, decimal_places=2)
    expiration_date: date


class Product(ProductBase, table=True):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_products_quantity_non_negative"),
        CheckConstraint("price >= 0", name="ck_products_price_non_negative"),
    )

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    farmer_id: int = Field(foreign_key="farmers.id", index=True)

    farmer: Optional["Farmer"] = Relationship(back_populates="products")


class ProductCreate(ProductBase):
    farmer_public_id: UUID

    @field_validator("expiration_date")
    @classmethod
    def expiration_date_not_past(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("Não é possível cadastrar produto vencido")
        return value


class ProductUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    picture_url: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    price: Decimal | None = Field(default=None, ge=0, max_digits=8, decimal_places=2)
    expiration_date: date | None = None

    @field_validator("expiration_date")
    @classmethod
    def update_expiration_date_not_past(cls, value: date | None) -> date | None:
        if value is not None and value < date.today():
            raise ValueError("Atualização faz com que o produto esteja fora da validade")
        return value


class ProductRead(ProductBase):
    public_id: UUID
    created_at: datetime
    farmer_id: int