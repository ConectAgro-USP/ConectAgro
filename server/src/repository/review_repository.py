from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.models.farmer import Farmer
from src.models.purchase import Purchase, PurchasePart, PurchaseStatus
from src.models.review import Review, ReviewAuthor


class DuplicateReviewError(Exception):
    pass


class ReviewRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_public_id(self, public_id: UUID) -> Review | None:
        statement = select(Review).where(Review.public_id == public_id)
        return self.session.exec(statement).first()

    def get_farmer_by_public_id(self, public_id: UUID) -> Farmer | None:
        statement = select(Farmer).where(Farmer.public_id == public_id)
        return self.session.exec(statement).first()

    def list_by_farmer(self, farmer_id: int) -> list[Review]:
        statement = select(Review).where(Review.farmer_id == farmer_id)
        statement = statement.order_by(Review.created_at.desc(), Review.id.desc())
        return list(self.session.exec(statement).all())

    def list_reviewable_parts(self, author: ReviewAuthor) -> list[PurchasePart]:
        # o campo vazio do autor vira IS NULL, igual ao que a avaliação guarda
        reviewed = select(Review.id).where(
            Review.purchase_id == PurchasePart.purchase_id,
            Review.farmer_id == PurchasePart.farmer_id,
            Review.apartment_id == author.apartment_id,
            Review.buyer_id == author.buyer_id,
        )
        statement = select(PurchasePart).join(Purchase).where(
            Purchase.apartment_id == author.building_id,
            PurchasePart.status == PurchaseStatus.ENTREGUE,
            ~reviewed.exists(),
        )
        statement = statement.options(
            selectinload(PurchasePart.purchase),
            selectinload(PurchasePart.farmer).selectinload(Farmer.user),
        )
        statement = statement.order_by(PurchasePart.closed_at.desc(), PurchasePart.id.desc())
        return list(self.session.exec(statement).all())

    def save(self, review: Review) -> Review:
        self.session.add(review)
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise DuplicateReviewError from error
        self.session.refresh(review)
        return review
