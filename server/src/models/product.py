from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from pydantic import field_validator
from sqlalchemy import CheckConstraint, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .apartment import Apartment
    from .farmer import Farmer
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


class PurchaseStatus(StrEnum):
    EM_PROGRESSO = "EM PROGRESSO"
    ENTREGUE = "ENTREGUE"
    CANCELADA = "CANCELADA"


class PurchaseBase(SQLModel):
    expected_delivery_date: date


class Purchase(PurchaseBase, table=True):
    __tablename__ = "purchases"

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)

    status: PurchaseStatus = PurchaseStatus.EM_PROGRESSO
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    closed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    apartment_id: int = Field(foreign_key="apartments.id", index=True)
    farmer_id: int = Field(foreign_key="farmers.id", index=True)

    apartment: Optional["Apartment"] = Relationship(back_populates="purchases")
    farmer: Optional["Farmer"] = Relationship(back_populates="purchases")
    purchase_products: list["PurchaseProduct"] = Relationship(
        back_populates="purchase", cascade_delete=True
    )

    @property
    def apartment_public_id(self) -> UUID:
        return self.apartment.public_id

    @property
    def farmer_public_id(self) -> UUID:
        return self.farmer.public_id


class PurchaseProductBase(SQLModel):
    quantity: int = Field(gt=0, le=INT4_MAX)
    unit_price: Decimal = Field(ge=0, max_digits=8, decimal_places=2)


class PurchaseProduct(PurchaseProductBase, table=True):
    __tablename__ = "purchase_products"

    purchase_id: int = Field(foreign_key="purchases.id", primary_key=True)
    product_id: int = Field(foreign_key="products.id", primary_key=True, index=True)

    purchase: Optional["Purchase"] = Relationship(back_populates="purchase_products")
    product: Optional["Product"] = Relationship()

    @property
    def product_public_id(self) -> UUID:
        return self.product.public_id


class PurchaseProductRead(PurchaseProductBase):
    product_public_id: UUID


class PurchaseRead(PurchaseBase):
    public_id: UUID
    apartment_public_id: UUID
    farmer_public_id: UUID
    status: PurchaseStatus
    created_at: datetime
    closed_at: datetime | None
    purchase_products: list[PurchaseProductRead]
