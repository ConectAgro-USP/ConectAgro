from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID, uuid4

from pydantic import field_validator
from sqlalchemy import CheckConstraint, UniqueConstraint
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
    farmer_public_id: UUID

class PurchaseStatus(str, Enum):
    EM_PROGRESSO = "EM PROGRESSO"
    ENTREGUE = "ENTREGUE"
    CANCELADA = "CANCELADA"

class Purchase(SQLModel, table=True):
    __tablename__ = "purchases"
    
    id: int | None = Field(default=None, primary_key=True)
    apartment_id: int = Field(foreign_key="apartments.id", index=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expected_delivery_date: datetime
    closed_at: Optional[datetime] = None

    purchase_parts: List["PurchasePart"] = Relationship(back_populates="purchase")
    apartment: "Apartment" = Relationship(back_populates="purchases")
    
    @property
    def status(self) -> PurchaseStatus:
        if not self.purchase_parts:
            return PurchaseStatus.EM_PROGRESSO
        
        status = {part.status for part in self.purchase_parts}

        if status == {PurchaseStatus.ENTREGUE}:
            return PurchaseStatus.ENTREGUE
        
        elif status == {PurchaseStatus.CANCELADA}:
            return PurchaseStatus.CANCELADA

        else:
            return PurchaseStatus.EM_PROGRESSO
    

class PurchaseProduct(SQLModel, table=True):
    __tablename__ = "purchase_products"

    id: Optional[int] = Field(default=None, primary_key=True)
    purchase_part_id: int = Field(foreign_key="purchase_parts.id", index=True)
    product_id: int = Field(foreign_key="products.id", index=True)
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0.0)

    purchase_part: "PurchasePart" = Relationship(back_populates="items")
    product: "Product" = Relationship()

class PurchasePart(SQLModel, table=True):
    __tablename__ = "purchase_parts"
    __table_args__ = (
        UniqueConstraint("purchase_id", "farmer_id", name="uq_purchase_parts_purchase_farmer"),
    )
    id : int | None = Field(default=None, primary_key=True)
    purchase_id: int = Field(foreign_key="purchases.id", index=True)
    farmer_id: int = Field(foreign_key="farmers.id", index=True)
    status : PurchaseStatus = Field(default=PurchaseStatus.EM_PROGRESSO)
    closed_at: Optional[datetime] = None

    purchase: "Purchase" = Relationship(back_populates="purchase_parts")
    farmer: "Farmer" = Relationship(back_populates="purchase_parts")

    items: List["PurchaseProduct"] = Relationship(back_populates="purchase_part")

class PurchasePartRead(SQLModel):
    id: int
    farmer_id: int
    status: PurchaseStatus
    closed_at: Optional[datetime] = None

class PurchaseRead(SQLModel):
    id: int
    apartment_id: int
    created_at: datetime
    expected_delivery_date: datetime
    status: PurchaseStatus
    purchase_parts: List[PurchasePartRead] = []
