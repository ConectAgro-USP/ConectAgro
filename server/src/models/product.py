from datetime import UTC, date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional, List
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo
from enum import Enum

from pydantic import field_validator
from sqlalchemy import CheckConstraint, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .farmer import Farmer
    from .apartment import Apartment
    from .interest import Interest

INT4_MAX = 2_147_483_647
BUSINESS_TZ = ZoneInfo("America/Sao_Paulo")


def _today() -> date:
    return datetime.now(BUSINESS_TZ).date()


class ProductBase(SQLModel):
    name: str = Field(min_length=1)
    description: str | None = None
    picture_url: str | None = None
    quantity: int = Field(ge=0, le=INT4_MAX)
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
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )

    farmer_id: int = Field(foreign_key="farmers.id", index=True)

    farmer: Optional["Farmer"] = Relationship(back_populates="products")
    interests: list["Interest"] = Relationship(back_populates="product", cascade_delete=True)

    @property
    def farmer_public_id(self) -> UUID:
        return self.farmer.public_id


class ProductCreate(ProductBase):
    farmer_public_id: UUID

    @field_validator("expiration_date")
    @classmethod
    def expiration_date_not_past(cls, value: date) -> date:
        if value < _today():
            raise ValueError("Não é possível cadastrar produto vencido")
        return value


class ProductUpdate(SQLModel):
    # o default None marca campo não enviado, e o tipo sem None recusa null explícito
    name: str = Field(default=None, min_length=1)
    description: str | None = None
    picture_url: str | None = None
    quantity: int = Field(default=None, ge=0, le=INT4_MAX)
    price: Decimal = Field(default=None, ge=0, max_digits=8, decimal_places=2)
    expiration_date: date = Field(default=None)

    @field_validator("expiration_date")
    @classmethod
    def update_expiration_date_not_past(cls, value: date) -> date:
        if value < _today():
            raise ValueError("Atualização faz com que o produto esteja fora da validade")
        return value


class ProductRead(ProductBase):
    public_id: UUID
    created_at: datetime
    farmer_public_id: UUID

class PurchaseStatus(str, Enum):
    EM_PROGRESSO = "EM PROGRESSO"
    ENTREGUE = "ENTREGUE"
    CANCELADA = "CANCELADA"

class Purchase(SQLModel, table=True):
    __tablename__ = "purchases"
    
    id: int | None = Field(default=None, primary_key=True)
    apartment_id: int = Field(foreign_key="apartments.id", index=True)
    farmer_id: int = Field(foreign_key="farmers.id", index=True)

    status : PurchaseStatus = Field(default=PurchaseStatus.EM_PROGRESSO)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expected_delivery_date: datetime
    closed_at: Optional[datetime] = None

    items: List["PurchaseProduct"] = Relationship(back_populates="purchase")

    apartment: "Apartment" = Relationship(back_populates="purchases")
    farmer: "Farmer" = Relationship(back_populates="purchases")

class PurchaseProduct(SQLModel, table=True):
    __tablename__ = "purchase_products"

    id: Optional[int] = Field(default=None, primary_key=True)
    purchase_id: int = Field(foreign_key="purchases.id", index=True)
    product_id: int = Field(foreign_key="products.id", index=True)
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0.0)

    purchase: "Purchase" = Relationship(back_populates="items")
    product: "Product" = Relationship()
