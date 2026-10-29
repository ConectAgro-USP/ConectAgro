from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, Optional, List
from uuid import UUID, uuid4

from sqlalchemy import DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from .product import INT4_MAX

if TYPE_CHECKING:
    from .apartment import Apartment
    from .farmer import Farmer
    from .product import Product

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

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    closed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    apartment_id: int = Field(foreign_key="apartments.id", index=True)

    apartment: Optional["Apartment"] = Relationship(back_populates="purchases")

    purchase_parts: list["PurchasePart"] = Relationship(
        back_populates="purchase", cascade_delete=True
    )

    @property
    def status(self) -> PurchaseStatus:
        if not self.purchase_parts:
            return PurchaseStatus.EM_PROGRESSO

        statuses = {part.status for part in self.purchase_parts}

        if statuses == {PurchaseStatus.ENTREGUE}:
            return PurchaseStatus.ENTREGUE
        elif statuses == {PurchaseStatus.CANCELADA}:
            return PurchaseStatus.CANCELADA
        else:
            return PurchaseStatus.EM_PROGRESSO
        
    @property
    def apartment_public_id(self) -> UUID:
        return self.apartment.public_id

class PurchasePart(SQLModel, table=True):
    __tablename__ = "purchase_parts"
    __table_args__ = (
        UniqueConstraint("purchase_id", "farmer_id", name="uq_purchase_parts_purchase_farmer"),
    )
    id : int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)

    purchase_id: int = Field(foreign_key="purchases.id", index=True)
    farmer_id: int = Field(foreign_key="farmers.id", index=True)
    
    status : PurchaseStatus = Field(default=PurchaseStatus.EM_PROGRESSO)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    closed_at: Optional[datetime] = None

    purchase: Optional["Purchase"] = Relationship(back_populates="purchase_parts")
    farmer: Optional["Farmer"] = Relationship(back_populates="purchase_parts")
    purchase_products: list["PurchaseProduct"] = Relationship(
        back_populates="purchase_part", cascade_delete=True
    )

    @property
    def farmer_public_id(self) -> UUID:
        return self.farmer.public_id

class PurchaseProductBase(SQLModel):
    quantity: int = Field(gt=0, le=INT4_MAX)
    unit_price: Decimal = Field(ge=0, max_digits=8, decimal_places=2)


class PurchaseProduct(PurchaseProductBase, table=True):
    __tablename__ = "purchase_products"

    purchase_part_id: int = Field(foreign_key="purchase_parts.id", primary_key=True, index=True)
    product_id: int = Field(foreign_key="products.id", primary_key=True, index=True)

    purchase_part: Optional["PurchasePart"] = Relationship(back_populates="purchase_products")
    product: Optional["Product"] = Relationship()

    @property
    def product_public_id(self) -> UUID:
        return self.product.public_id

class PurchaseProductRead(PurchaseProductBase):
    product_public_id: UUID

class PurchasePartRead(SQLModel):
    public_id: UUID
    farmer_public_id: UUID
    status: PurchaseStatus
    created_at: datetime
    closed_at: datetime | None
    purchase_products: list[PurchaseProductRead] = []


class PurchaseRead(PurchaseBase):
    public_id: UUID
    apartment_public_id: UUID
    status: PurchaseStatus
    created_at: datetime
    closed_at: datetime | None
    purchase_parts: list[PurchasePartRead] = []