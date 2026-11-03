from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, SQLModel, select

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.user import User


class DuplicateValueError(Exception):
    pass


class ProfileRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_apartment_by_public_id(self, public_id: UUID) -> Apartment | None:
        statement = select(Apartment).where(Apartment.public_id == public_id)
        return self.session.exec(statement).first()

    def get_user_by_cpf(self, cpf: str) -> User | None:
        statement = select(User).where(User.cpf == cpf)
        return self.session.exec(statement).first()

    def list_apartments_by_cnpj(self, cnpj: str) -> list[Apartment]:
        statement = select(Apartment).where(Apartment.building_cnpj == cnpj)
        statement = statement.order_by(Apartment.id)
        return list(self.session.exec(statement).all())

    def list_buyers_of_apartment(
        self, apartment_id: int, link_status: LinkStatus | None
    ) -> list[Buyer]:
        statement = select(Buyer).where(Buyer.apartment_id == apartment_id)
        if link_status is not None:
            statement = statement.where(Buyer.link_status == link_status)
        statement = statement.options(selectinload(Buyer.user))
        statement = statement.order_by(Buyer.link_requested_at, Buyer.id)
        return list(self.session.exec(statement).all())

    def lock_buyer_of_apartment(self, public_id: UUID, apartment_id: int) -> Buyer | None:
        statement = select(Buyer).where(
            Buyer.public_id == public_id, Buyer.apartment_id == apartment_id
        )
        statement = statement.with_for_update()
        return self.session.exec(statement).first()

    def lock_and_reload(self, item: SQLModel) -> None:
        # o refresh descarta mudanças pendentes, por isso elas são gravadas antes
        self.session.flush()
        self.session.refresh(item, with_for_update=True)

    def add(self, item: SQLModel) -> None:
        self.session.add(item)

    def commit(self) -> None:
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise DuplicateValueError from error
