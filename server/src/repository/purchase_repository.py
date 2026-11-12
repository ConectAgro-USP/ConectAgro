from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import Product
from src.models.purchase import Purchase, PurchasePart, PurchaseProduct, PurchaseStatus
from src.models.purchase_history import (
    BuildingPurchasesFilters,
    PurchaseHistoryFilters,
    SalesFilters,
)


class PurchaseRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_public_id(self, public_id: UUID) -> Purchase | None:
        parts = selectinload(Purchase.purchase_parts)
        items = parts.selectinload(PurchasePart.purchase_products)
        statement = select(Purchase).where(Purchase.public_id == public_id)
        statement = statement.options(
            parts.selectinload(PurchasePart.farmer),
            items.selectinload(PurchaseProduct.product),
        )
        return self.session.exec(statement).first()

    def lock_by_public_id(self, public_id: UUID) -> Purchase | None:
        # trava antes de ler, para as partes virem atualizadas
        statement = select(Purchase.id).where(Purchase.public_id == public_id)
        if self.session.exec(statement.with_for_update()).first() is None:
            return None
        return self.get_by_public_id(public_id)

    def lock_products(self, public_ids: list[UUID]) -> list[Product]:
        # sempre na mesma ordem, para duas compras não se travarem
        statement = select(Product).where(Product.public_id.in_(public_ids))
        statement = statement.order_by(Product.id).with_for_update()
        # lê de novo o produto já carregado, para ter o estoque atual
        statement = statement.execution_options(populate_existing=True)
        return list(self.session.exec(statement).all())

    def list_sales(
        self, farmer_id: int, filters: SalesFilters, since: datetime | None, until: datetime | None
    ) -> tuple[list[PurchasePart], int]:
        conditions = [PurchasePart.farmer_id == farmer_id, *_in_period(since, until)]
        if filters.status is not None:
            conditions.append(PurchasePart.status == filters.status)
        if filters.apartment_public_id is not None:
            conditions.append(Apartment.public_id == filters.apartment_public_id)
        count = select(func.count(PurchasePart.id)).join(Purchase).join(Apartment)
        total = self.session.exec(count.where(*conditions)).one()
        statement = select(PurchasePart).join(Purchase).join(Apartment).where(*conditions)
        statement = statement.options(
            selectinload(PurchasePart.purchase).selectinload(Purchase.apartment),
            selectinload(PurchasePart.purchase_products).selectinload(PurchaseProduct.product),
        )
        return self._page(statement, filters), total

    def list_building_purchases(
        self,
        apartment_id: int,
        filters: BuildingPurchasesFilters,
        since: datetime | None,
        until: datetime | None,
    ) -> tuple[list[Purchase], int]:
        conditions = [Purchase.apartment_id == apartment_id, *_in_period(since, until)]
        if filters.status is not None:
            conditions.append(_has_status(filters.status))
        if filters.farmer_public_id is not None:
            of_farmer = PurchasePart.farmer.has(Farmer.public_id == filters.farmer_public_id)
            conditions.append(Purchase.purchase_parts.any(of_farmer))
        count = select(func.count(Purchase.id)).where(*conditions)
        parts = selectinload(Purchase.purchase_parts)
        items = parts.selectinload(PurchasePart.purchase_products)
        statement = select(Purchase).where(*conditions)
        statement = statement.options(
            parts.selectinload(PurchasePart.farmer).selectinload(Farmer.user),
            items.selectinload(PurchaseProduct.product),
        )
        return self._page(statement, filters), self.session.exec(count).one()

    def sales_totals(
        self, farmer_id: int, filters: SalesFilters, since: datetime | None, until: datetime | None
    ) -> dict[PurchaseStatus, Decimal]:
        conditions = [PurchasePart.farmer_id == farmer_id, *_in_period(since, until)]
        if filters.apartment_public_id is not None:
            of_building = Apartment.public_id == filters.apartment_public_id
            conditions.append(Purchase.apartment.has(of_building))
        return self._totals(conditions)

    def building_totals(
        self,
        apartment_id: int,
        filters: BuildingPurchasesFilters,
        since: datetime | None,
        until: datetime | None,
    ) -> dict[PurchaseStatus, Decimal]:
        conditions = [Purchase.apartment_id == apartment_id, *_in_period(since, until)]
        if filters.farmer_public_id is not None:
            # com o filtro, o total soma só as partes daquele agricultor
            of_farmer = Farmer.public_id == filters.farmer_public_id
            conditions.append(PurchasePart.farmer.has(of_farmer))
        return self._totals(conditions)

    def _totals(self, conditions: list) -> dict[PurchaseStatus, Decimal]:
        value = func.sum(PurchaseProduct.quantity * PurchaseProduct.unit_price)
        statement = select(PurchasePart.status, value).join(Purchase).join(PurchaseProduct)
        statement = statement.where(*conditions)
        return dict(self.session.exec(statement.group_by(PurchasePart.status)).all())

    def _page(self, statement, filters: PurchaseHistoryFilters) -> list:
        statement = statement.order_by(Purchase.created_at.desc(), Purchase.id.desc())
        offset = (filters.page - 1) * filters.page_size
        return list(self.session.exec(statement.offset(offset).limit(filters.page_size)).all())

    def add(self, purchase: Purchase) -> None:
        self.session.add(purchase)

    def commit(self) -> None:
        self.session.commit()


def _in_period(since: datetime | None, until: datetime | None) -> list:
    conditions = []
    if since is not None:
        conditions.append(Purchase.created_at >= since)
    if until is not None:
        conditions.append(Purchase.created_at < until)
    return conditions


def _has_status(status: PurchaseStatus):
    # mesma regra do status da compra, que fecha quando nenhuma parte está em progresso
    has_open = Purchase.purchase_parts.any(PurchasePart.status == PurchaseStatus.EM_PROGRESSO)
    has_delivered = Purchase.purchase_parts.any(PurchasePart.status == PurchaseStatus.ENTREGUE)
    if status == PurchaseStatus.EM_PROGRESSO:
        return has_open
    if status == PurchaseStatus.ENTREGUE:
        return ~has_open & has_delivered
    return ~has_open & ~has_delivered
