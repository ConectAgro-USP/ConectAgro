from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .buyer import Buyer
    from .product import Product

INT4_MAX = 2_147_483_647


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
    product_id: int = Field(foreign_key="products.id", index=True, ondelete="CASCADE")

    buyer: Optional["Buyer"] = Relationship(back_populates="interests")
    product: Optional["Product"] = Relationship(back_populates="interests")

    @property
    def buyer_public_id(self) -> UUID:
        return self.buyer.public_id

    @property
    def product_public_id(self) -> UUID:
        return self.product.public_id


class InterestCreate(InterestBase):
    buyer_public_id: UUID
    product_public_id: UUID


class InterestUpdate(SQLModel):
    # o default None marca campo não enviado, e o tipo sem None recusa null explícito
    quantity: int = Field(default=None, gt=0, le=INT4_MAX)


class InterestRead(InterestBase):
    public_id: UUID
    buyer_public_id: UUID
    product_public_id: UUID
    created_at: datetime
    updated_at: datetime | None
