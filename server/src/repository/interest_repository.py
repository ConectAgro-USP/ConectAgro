from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.exc import StaleDataError
from sqlmodel import Session, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.interest import Interest
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import PurchasePart, PurchaseStatus
from src.repository.profile_repository import DuplicateValueError


class InterestGoneError(Exception):
    pass


def open_interest():
    # sem parte, ou com a parte cancelada, o interesse volta às necessidades
    cancelled = Interest.purchase_part.has(PurchasePart.status == PurchaseStatus.CANCELADA)
    return or_(Interest.purchase_part_id.is_(None), cancelled)


class InterestRepository:
    def __init__(self, session: Session):
        self.session = session

    def list_by_buyer_id(self, buyer_id: int) -> list[Interest]:
        statement = (
            select(Interest)
            .where(Interest.buyer_id == buyer_id)
            .options(
                selectinload(Interest.product)
                .selectinload(Product.farmer)
                .selectinload(Farmer.user),
                selectinload(Interest.purchase_part).selectinload(PurchasePart.purchase),
            )
            .order_by(Interest.created_at.desc())
        )
        return list(self.session.exec(statement).all())

    def get_product_by_public_id(self, public_id: UUID) -> Product | None:
        statement = select(Product).where(Product.public_id == public_id)
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

    def list_by_buyer(self, buyer: Buyer) -> list[Interest]:
        statement = (
            select(Interest)
            .where(Interest.buyer_id == buyer.id)
            .options(selectinload(Interest.product))
            .order_by(Interest.created_at.desc())
        )
        return list(self.session.exec(statement).all())

    def list_apartment_needs(self, apartment: Apartment, descending: bool):
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
            ordering.desc() if descending else ordering.asc(), Product.public_id
        )
        return list(self.session.exec(statement).all())

    def create(self, interest: Interest) -> None:
        self.session.add(interest)

    def update(self, interest: Interest) -> Interest:
        self.session.add(interest)
        try:
            self.session.commit()
        except StaleDataError as error:
            self.session.rollback()
            raise InterestGoneError from error
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
