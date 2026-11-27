from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.interest import ApartmentNeedsFilters, Interest, MyInterestsFilters
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import PurchasePart, PurchaseStatus
from src.repository.pagination import fetch_page
from src.repository.product_repository import on_sale
from src.repository.profile_repository import DuplicateValueError

CENT = Decimal("0.01")


def open_interest():
    # sem parte, ou com a parte cancelada, o interesse volta às necessidades
    cancelled = Interest.purchase_part.has(PurchasePart.status == PurchaseStatus.CANCELADA)
    return or_(Interest.purchase_part_id.is_(None), cancelled)


class InterestRepository:
    def __init__(self, session: Session):
        self.session = session

    def list_by_buyer_id(
        self, buyer_id: int, filters: MyInterestsFilters
    ) -> tuple[list[Interest], int]:
        statement = (
            select(Interest)
            .where(*self._buyer_conditions(buyer_id, filters))
            .options(
                selectinload(Interest.product)
                .selectinload(Product.farmer)
                .selectinload(Farmer.user),
                selectinload(Interest.purchase_part).selectinload(PurchasePart.purchase),
            )
            .order_by(Interest.created_at.desc(), Interest.id.desc())
        )
        return fetch_page(self.session, statement, filters)

    def estimated_total(self, buyer_id: int, filters: MyInterestsFilters, today: date) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(Interest.quantity * Product.price), 0))
            .join(Product, Product.id == Interest.product_id)
            .where(*self._buyer_conditions(buyer_id, filters), open_interest(), on_sale(today))
        )
        return Decimal(str(self.session.exec(statement).one())).quantize(CENT)

    @staticmethod
    def _buyer_conditions(buyer_id: int, filters: MyInterestsFilters) -> list:
        conditions = [Interest.buyer_id == buyer_id]
        if filters.product_public_id is not None:
            product_id = select(Product.id).where(Product.public_id == filters.product_public_id)
            conditions.append(Interest.product_id == product_id.scalar_subquery())
        return conditions

    def lock_product_by_public_id(self, public_id: UUID) -> Product | None:
        # espera a troca de unidade em curso, e a troca espera o interesse
        statement = select(Product).where(Product.public_id == public_id)
        statement = statement.with_for_update(read=True, key_share=True)
        statement = statement.execution_options(populate_existing=True)
        return self.session.exec(statement).first()

    def get_by_public_id(self, public_id: UUID) -> Interest | None:
        statement = select(Interest).where(Interest.public_id == public_id)
        return self.session.exec(statement).first()

    def lock_by_public_id(self, public_id: UUID) -> Interest | None:
        # espera a compra que liga o interesse, para ler o vínculo atual
        statement = select(Interest).where(Interest.public_id == public_id)
        statement = statement.with_for_update().execution_options(populate_existing=True)
        return self.session.exec(statement).first()

    def get_by_buyer_and_product(self, buyer: Buyer, product: Product) -> Interest | None:
        statement = select(Interest).where(
            Interest.buyer_id == buyer.id, Interest.product_id == product.id
        )
        return self.session.exec(statement).first()

    def list_apartment_needs(self, apartment: Apartment, filters: ApartmentNeedsFilters):
        today = datetime.now(BUSINESS_TZ).date()
        statement = (
            select(Product, func.sum(Interest.quantity), func.count(func.distinct(Buyer.id)))
            .join(Interest, Interest.product_id == Product.id)
            .join(Buyer, Buyer.id == Interest.buyer_id)
            .where(
                Buyer.apartment_id == apartment.id,
                Product.expiration_date >= today,
                Product.is_available,
                Buyer.link_status == LinkStatus.APROVADO,
                open_interest(),
            )
            .options(selectinload(Product.farmer).selectinload(Farmer.user))
            .group_by(Product.id)
        )
        ordering = func.sum(Interest.quantity)
        statement = statement.order_by(
            ordering.desc() if filters.descending else ordering.asc(), Product.public_id
        )
        return fetch_page(self.session, statement, filters)

    def create(self, interest: Interest) -> None:
        self.session.add(interest)

    def update(self, interest: Interest) -> Interest:
        self.session.add(interest)
        self.session.commit()
        self.session.refresh(interest)
        return interest

    def delete(self, interest: Interest) -> None:
        self.session.delete(interest)
        self.session.commit()

    def commit(self) -> None:
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise DuplicateValueError from error
