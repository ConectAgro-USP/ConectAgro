from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from .product import AVAILABLE, BUSINESS_TZ, INT4_MAX, UNAVAILABLE, ProductDetailRead

if TYPE_CHECKING:
    from .buyer import Buyer
    from .product import Product


class InterestBase(SQLModel):
    quantity: int = Field(gt=0, le=INT4_MAX)


class Interest(InterestBase, table=True):
    __tablename__ = "interests"
    __table_args__ = (
        UniqueConstraint("buyer_id", "product_id", name="uq_interests_buyer_id_product_id"),
        CheckConstraint("quantity > 0", name="ck_interests_quantity_positive"),
    )

    id: int | None = Field(default=None, primary_key=True)
    public_id: UUID = Field(default_factory=uuid4, unique=True, index=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column_kwargs={"onupdate": lambda: datetime.now(UTC)},
        sa_type=DateTime(timezone=True),
    )

    buyer_id: int = Field(foreign_key="buyers.id", index=True, ondelete="CASCADE")
    product_id: int | None = Field(
        default=None, foreign_key="products.id", index=True, ondelete="SET NULL"
    )
    product_public_id_snapshot: UUID | None = None
    product_name_snapshot: str | None = None

    buyer: Optional["Buyer"] = Relationship(back_populates="interests")
    product: Optional["Product"] = Relationship(back_populates="interests")

    @property
    def buyer_public_id(self) -> UUID | None:
        return self.buyer.public_id if self.buyer else None

    @property
    def product_public_id(self) -> UUID | None:
        # produto removido não tem mais página, então o id não vai para a tela
        return self.product.public_id if self.product is not None else None

    @property
    def product_name(self) -> str | None:
        if self.product is not None:
            return self.product.name
        return self.product_name_snapshot

    
    @property
    def product_status(self) -> str:
        if self.product is None:
            return UNAVAILABLE
        today = datetime.now(BUSINESS_TZ).date()
        if (
            self.product.is_available
            and self.product.quantity > 0
            and self.product.expiration_date >= today
        ):
            return AVAILABLE
        return UNAVAILABLE


class InterestCreate(InterestBase):
    product_public_id: UUID


class ApartmentNeedRead(SQLModel):
    product: ProductDetailRead
    total_quantity: int = Field(gt=0)
    interested_buyers_count: int = Field(gt=0)


class InterestUpdate(SQLModel):
    # o default None marca campo não enviado, e o tipo sem None recusa null explícito
    quantity: int = Field(default=None, gt=0, le=INT4_MAX)


class InterestRead(InterestBase):
    public_id: UUID
    buyer_public_id: UUID
    product_public_id: UUID | None
    product_name: str | None
    product_status: str
    created_at: datetime
    updated_at: datetime | None
