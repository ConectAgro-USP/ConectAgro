from datetime import UTC, datetime
from typing import TYPE_CHECKING, Annotated, NamedTuple, Optional
from uuid import UUID, uuid4

from pydantic import AfterValidator, Strict
from sqlalchemy import CheckConstraint, DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from src.core.text import reject_null_character, short_name

from .pagination import PageParams, PaginatedResponse

if TYPE_CHECKING:
    from .apartment import Apartment
    from .buyer import Buyer
    from .farmer import Farmer
    from .purchase import Purchase

Comment = Annotated[str, AfterValidator(reject_null_character)]
# sem o Strict o pydantic converte booleano e texto em nota
Rating = Annotated[int, Strict()]


class ReviewBase(SQLModel):
    rating: Rating = Field(
        ge=1,
        le=5,
    )

    comment: Comment = Field(
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
    def farmer_public_id(self) -> UUID | None:
        return self.farmer.public_id if self.farmer else None

    @property
    def farmer_short_name(self) -> str | None:
        return short_name(self.farmer.user.name) if self.farmer else None

    @property
    def purchase_public_id(self) -> UUID | None:
        return self.purchase.public_id if self.purchase else None


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(SQLModel):
    # o default None marca campo não enviado, e o tipo sem None recusa null explícito
    rating: Rating = Field(default=None, ge=1, le=5)
    comment: Comment = Field(default=None, max_length=500)


class ReviewRead(ReviewBase):
    public_id: UUID
    purchase_public_id: UUID
    farmer_public_id: UUID
    apartment_public_id: UUID | None
    buyer_public_id: UUID | None
    created_at: datetime
    updated_at: datetime | None


class AuthorReviewRead(ReviewRead):
    farmer_short_name: str


class ReviewAuthor(NamedTuple):
    building_id: int
    # o síndico avalia pelo prédio e o morador pelo próprio cadastro, só um dos dois é preenchido
    apartment_id: int | None = None
    buyer_id: int | None = None


class ReviewableRead(SQLModel):
    purchase_public_id: UUID
    farmer_public_id: UUID
    farmer_short_name: str
    delivered_at: datetime | None
    product_names: list[str]


class FarmerReviewRead(ReviewBase):
    # sem os ids da compra e do autor, para a lista não mostrar quem compra de cada agricultor
    public_id: UUID
    created_at: datetime
    updated_at: datetime | None


class FarmerReviewsRead(SQLModel):
    average_rating: float | None
    reviews_count: int
    reviews: list[FarmerReviewRead]


class FarmerReviewsFilters(PageParams):
    # a página do produto só mostra as avaliações escritas
    with_comment: bool = False


class FarmerReviewsPage(PaginatedResponse[FarmerReviewRead]):
    # a média e a contagem valem para todas as avaliações do agricultor
    average_rating: float | None
    reviews_count: int


AuthorReviewsPage = PaginatedResponse[AuthorReviewRead]
ReviewablesPage = PaginatedResponse[ReviewableRead]
