from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, SQLModel, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus


class DuplicateProfileDataError(Exception):
    pass


class ProfileRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_apartment_by_public_id(self, public_id: UUID) -> Apartment | None:
        statement = select(Apartment).where(Apartment.public_id == public_id)
        return self.session.exec(statement).first()

    def get_apartment_by_cnpj(self, cnpj: str) -> Apartment | None:
        statement = select(Apartment).where(Apartment.building_cnpj == cnpj)
        return self.session.exec(statement).first()

    def list_apartments(self, name: str | None, offset: int, limit: int) -> list[Apartment]:
        statement = select(Apartment)
        if name is not None:
            # autoescape trata o % e o _ digitados como texto, não como coringa
            name_matches = Apartment.building_name.icontains(name, autoescape=True)
            statement = statement.where(name_matches)
        statement = statement.order_by(Apartment.building_name, Apartment.id)
        statement = statement.offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def list_buyers_of_apartment(
        self, apartment_id: int, link_status: LinkStatus | None, offset: int, limit: int
    ) -> list[Buyer]:
        statement = select(Buyer).where(Buyer.apartment_id == apartment_id)
        if link_status is not None:
            statement = statement.where(Buyer.link_status == link_status)
        statement = statement.options(selectinload(Buyer.user))
        statement = statement.order_by(Buyer.link_requested_at, Buyer.id)
        statement = statement.offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def get_buyer_of_apartment_locked(self, public_id: UUID, apartment_id: int) -> Buyer | None:
        statement = select(Buyer).where(
            Buyer.public_id == public_id, Buyer.apartment_id == apartment_id
        )
        statement = statement.with_for_update()
        return self.session.exec(statement).first()

    def lock(self, row: SQLModel) -> None:
        self.session.refresh(row, with_for_update=True)

    def add(self, item: SQLModel) -> None:
        self.session.add(item)

    def commit(self) -> None:
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            raise DuplicateProfileDataError from None
