from uuid import UUID

from src.models.farmer import Farmer
from src.models.pagination import PageParams
from src.models.purchase import Purchase, PurchasePart, PurchaseStatus
from src.models.review import (
    AuthorReviewRead,
    AuthorReviewsPage,
    FarmerReviewRead,
    FarmerReviewsFilters,
    FarmerReviewsPage,
    FarmerReviewsRead,
    Review,
    ReviewableRead,
    ReviewablesPage,
    ReviewAuthor,
    ReviewCreate,
    ReviewUpdate,
)
from src.repository.purchase_repository import PurchaseRepository
from src.repository.review_repository import DuplicateReviewError, ReviewRepository
from src.services.exceptions import (
    FarmerNotFoundError,
    NotReviewAuthorError,
    PurchaseAccessDeniedError,
    PurchaseNotFoundError,
    PurchasePartNotDeliveredError,
    ReviewAlreadyExistsError,
    ReviewNotFoundError,
)
from src.services.text_service import short_name


class ReviewService:
    def __init__(self, reviews: ReviewRepository, purchases: PurchaseRepository):
        self.reviews = reviews
        self.purchases = purchases

    def create(
        self,
        purchase_public_id: UUID,
        farmer_public_id: UUID,
        author: ReviewAuthor,
        review_in: ReviewCreate,
    ) -> Review:
        purchase = self.purchases.get_by_public_id(purchase_public_id)
        if purchase is None:
            raise PurchaseNotFoundError
        if purchase.apartment_id != author.building_id:
            raise PurchaseAccessDeniedError
        part = _part_of_farmer(purchase, farmer_public_id)
        if part is None:
            raise FarmerNotFoundError
        if part.status != PurchaseStatus.ENTREGUE:
            raise PurchasePartNotDeliveredError
        review = Review(
            purchase_id=purchase.id,
            farmer_id=part.farmer_id,
            apartment_id=author.apartment_id,
            buyer_id=author.buyer_id,
            **review_in.model_dump(),
        )
        try:
            return self.reviews.save(review)
        except DuplicateReviewError:
            raise ReviewAlreadyExistsError from None

    def update(self, public_id: UUID, author: ReviewAuthor, review_update: ReviewUpdate) -> Review:
        review = self.reviews.get_by_public_id(public_id)
        if review is None:
            raise ReviewNotFoundError
        if (review.apartment_id, review.buyer_id) != (author.apartment_id, author.buyer_id):
            raise NotReviewAuthorError
        review.sqlmodel_update(review_update.model_dump(exclude_unset=True))
        return self.reviews.save(review)

    def list_by_author(self, author: ReviewAuthor, params: PageParams) -> AuthorReviewsPage:
        reviews, total = self.reviews.list_by_author(author, params)
        items = [AuthorReviewRead.model_validate(review) for review in reviews]
        return AuthorReviewsPage.from_params(items, params, total)

    def list_reviewable(self, author: ReviewAuthor, params: PageParams) -> ReviewablesPage:
        parts, total = self.reviews.list_reviewable_parts(author, params)
        items = [
            ReviewableRead(
                purchase_public_id=part.purchase.public_id,
                farmer_public_id=part.farmer.public_id,
                farmer_short_name=short_name(part.farmer.user.name),
                delivered_at=part.closed_at,
                product_names=[
                    item.product_name for item in part.purchase_products if item.product_name
                ],
            )
            for part in parts
        ]
        return ReviewablesPage.from_params(items, params, total)

    def list_by_farmer_public_id(
        self, public_id: UUID, filters: FarmerReviewsFilters
    ) -> FarmerReviewsPage:
        farmer = self.reviews.get_farmer_by_public_id(public_id)
        if farmer is None:
            raise FarmerNotFoundError
        reviews, total = self.reviews.page_by_farmer(farmer.id, filters)
        average_rating, reviews_count = self.reviews.rating_of_farmer(farmer.id)
        return FarmerReviewsPage.from_params(
            [FarmerReviewRead.model_validate(review) for review in reviews],
            filters,
            total,
            average_rating=None if average_rating is None else round(average_rating, 2),
            reviews_count=reviews_count,
        )

    def list_by_farmer(self, farmer: Farmer) -> FarmerReviewsRead:
        reviews = self.reviews.list_by_farmer(farmer.id)
        average_rating = None
        if reviews:
            average_rating = round(sum(review.rating for review in reviews) / len(reviews), 2)
        return FarmerReviewsRead(
            average_rating=average_rating, reviews_count=len(reviews), reviews=reviews
        )


def _part_of_farmer(purchase: Purchase, farmer_public_id: UUID) -> PurchasePart | None:
    for part in purchase.purchase_parts:
        if part.farmer_public_id == farmer_public_id:
            return part
    return None
