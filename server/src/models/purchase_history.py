from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlmodel import Field, SQLModel

from src.models.pagination import PaginatedResponse
from src.models.product import INT4_MAX
from src.models.purchase import PurchaseProductRead, PurchaseStatus


class PurchaseHistoryFilters(SQLModel):
    status: PurchaseStatus | None = None
    date_from: date | None = None
    # o filtro soma um dia a esta data, e o último dia do calendário daria erro
    date_to: date | None = Field(default=None, lt=date.max)
    page: int = Field(default=1, ge=1, le=INT4_MAX)
    page_size: int = Field(default=20, ge=1, le=100)


class SalesFilters(PurchaseHistoryFilters):
    apartment_public_id: UUID | None = None


class PurchaseItemRead(PurchaseProductRead):
    product_name: str
    subtotal: Decimal


class SaleRead(SQLModel):
    purchase_public_id: UUID
    apartment_public_id: UUID
    building_name: str
    purchased_at: datetime
    status: PurchaseStatus
    closed_at: datetime | None
    total: Decimal
    purchase_products: list[PurchaseItemRead]


class HistoryPage[T](PaginatedResponse[T]):
    realized_total: Decimal
    expected_total: Decimal


SalesHistory = HistoryPage[SaleRead]
