from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, update
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.interest import Interest
from src.models.product import Product
from src.models.purchase import Purchase, PurchasePart, PurchaseProduct, PurchaseStatus
from src.models.purchase_history import (
    BuildingPurchasesFilters,
    PurchaseHistoryFilters,
    SalesFilters,
    SalesSort,
)
from src.repository.interest_repository import open_interest

NEWEST = (Purchase.created_at.desc(), Purchase.id.desc())
NEAREST_DELIVERY = (Purchase.expected_delivery_date, Purchase.created_at, Purchase.id)


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

    def link_open_interests(self, apartment_id: int, parts: list[PurchasePart]) -> None:
        # a parte precisa de id antes de receber os interesses
        self.session.flush()
        approved = select(Buyer.id).where(
            Buyer.apartment_id == apartment_id, Buyer.link_status == LinkStatus.APROVADO
        )
        for part in parts:
            product_ids = [item.product_id for item in part.purchase_products]
            statement = update(Interest).where(
                Interest.buyer_id.in_(approved),
                Interest.product_id.in_(product_ids),
                open_interest(),
            )
            # o vínculo não é edição do morador, então updated_at fica igual
            statement = statement.values(purchase_part_id=part.id, updated_at=Interest.updated_at)
            self.session.exec(statement.execution_options(synchronize_session=False))

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
        apartment = selectinload(PurchasePart.purchase).selectinload(Purchase.apartment)
        statement = statement.options(
            apartment.selectinload(Apartment.manager),
            selectinload(PurchasePart.purchase_products).selectinload(PurchaseProduct.product),
        )
        order = NEAREST_DELIVERY if filters.sort == SalesSort.DELIVERY else NEWEST
        return self._page(statement, filters, order), total

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

    def list_sale_buildings(self, farmer_id: int) -> list[Apartment]:
        of_farmer = Purchase.purchase_parts.any(PurchasePart.farmer_id == farmer_id)
        statement = select(Apartment).where(Apartment.purchases.any(of_farmer))
        return list(self.session.exec(statement.order_by(Apartment.building_name)).all())

    def list_purchase_farmers(self, apartment_id: int) -> list[Farmer]:
        of_building = PurchasePart.purchase.has(Purchase.apartment_id == apartment_id)
        statement = select(Farmer).where(Farmer.purchase_parts.any(of_building))
        return list(self.session.exec(statement.options(selectinload(Farmer.user))).all())

    def _totals(self, conditions: list) -> dict[PurchaseStatus, Decimal]:
        value = func.sum(PurchaseProduct.quantity * PurchaseProduct.unit_price)
        statement = select(PurchasePart.status, value).join(Purchase).join(PurchaseProduct)
        statement = statement.where(*conditions)
        return dict(self.session.exec(statement.group_by(PurchasePart.status)).all())

    def _page(self, statement, filters: PurchaseHistoryFilters, order: tuple = NEWEST) -> list:
        statement = statement.order_by(*order)
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
