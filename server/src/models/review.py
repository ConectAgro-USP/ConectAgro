from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .apartment import Apartment
    from .buyer import Buyer
    from .farmer import Farmer
    from .purchase import Purchase


class ReviewBase(SQLModel):
    rating: int = Field(
        ge=1,
        le=5,
    )

    comment: str = Field(
        default="",
        max_length=500,
        description="Comentário deixado pelo autor da avaliação",
    )


class Review(ReviewBase, table=True):
    __tablename__ = "reviews"

    __table_args__ = (
        CheckConstraint(
            "(apartment_id IS NOT NULL) != (buyer_id IS NOT NULL)",
            name="ck_review_exactly_one_author",
        ),
        UniqueConstraint(
            "purchase_id",
            "farmer_id",
            "apartment_id",
            name="uq_review_purchase_farmer_apartment",
        ),
        UniqueConstraint(
            "purchase_id",
            "farmer_id",
            "buyer_id",
            name="uq_review_purchase_farmer_buyer",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)

    public_id: UUID = Field(
        default_factory=uuid4,
        unique=True,
        index=True,
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),
    )

    updated_at: datetime | None = Field(
        default=None,
        sa_column_kwargs={"onupdate": lambda: datetime.now(UTC)},
        sa_type=DateTime(timezone=True),
    )

    purchase_id: int = Field(
        foreign_key="purchases.id",
        index=True,
    )

    farmer_id: int = Field(
        foreign_key="farmers.id",
        index=True,
    )

    apartment_id: int | None = Field(
        default=None,
        foreign_key="apartments.id",
        index=True,
    )

    buyer_id: int | None = Field(
        default=None,
        foreign_key="buyers.id",
        index=True,
    )

    purchase: Optional["Purchase"] = Relationship()
    farmer: Optional["Farmer"] = Relationship()
    apartment: Optional["Apartment"] = Relationship()
    buyer: Optional["Buyer"] = Relationship()

    @property
    def apartment_public_id(self) -> UUID | None:
        return self.apartment.public_id if self.apartment else None

    @property
    def buyer_public_id(self) -> UUID | None:
        return self.buyer.public_id if self.buyer else None

    @property
    def farmer_public_id(self) -> UUID:
        return self.farmer.public_id

    @property
    def purchase_public_id(self) -> UUID:
        return self.purchase.public_id


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(SQLModel):
    # o default None marca campo não enviado, e o tipo sem None recusa null explícito
    rating: int = Field(default=None, ge=1, le=5)
    comment: str = Field(default=None, max_length=500)


class ReviewRead(ReviewBase):
    public_id: UUID
    purchase_public_id: UUID
    farmer_public_id: UUID
    apartment_public_id: UUID | None
    buyer_public_id: UUID | None
    created_at: datetime
    updated_at: datetime | None
