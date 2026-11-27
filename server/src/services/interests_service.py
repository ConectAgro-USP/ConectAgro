from datetime import datetime
from uuid import UUID

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.interest import (
    ApartmentNeedRead,
    ApartmentNeedsFilters,
    ApartmentNeedsPage,
    Interest,
    InterestCreate,
    InterestRead,
    InterestUpdate,
    MyInterestsFilters,
    MyInterestsPage,
)
from src.models.product import BUSINESS_TZ, UNAVAILABLE, ProductDetailRead
from src.models.purchase import PurchaseStatus
from src.repository.interest_repository import InterestRepository
from src.repository.profile_repository import DuplicateValueError
from src.services.exceptions import (
    InterestAlreadyExistsError,
    InterestInPurchaseError,
    InterestNotFoundError,
    NotInterestOwnerDeleteError,
    NotInterestOwnerUpdateError,
    ProductNotFoundError,
    ProductUnavailableError,
    ProductUnitChangedError,
)
from src.services.product_service import farmer_summary


class InterestService:
    def __init__(self, interests: InterestRepository):
        self.interests = interests

    def create(self, buyer: Buyer, interest_in: InterestCreate) -> Interest:
        product = self.interests.lock_product_by_public_id(interest_in.product_public_id)
        if product is None:
            raise ProductNotFoundError
        if interest_in.unit is not None and interest_in.unit != product.unit:
            raise ProductUnitChangedError
        if self.interests.get_by_buyer_and_product(buyer, product) is not None:
            raise InterestAlreadyExistsError
        interest = Interest.model_validate(
            interest_in,
            update={
                "buyer_id": buyer.id,
                "product_id": product.id,
                "product_public_id_snapshot": product.public_id,
                "product_name_snapshot": product.name,
                "product": product,
                "quantity": interest_in.quantity,
            },
        )
        if interest.product_status == UNAVAILABLE:
            raise ProductUnavailableError

        self.interests.create(interest)
        try:
            self.interests.commit()
        except DuplicateValueError:
            raise InterestAlreadyExistsError from None
        return interest

    def list_interests(self, buyer: Buyer, filters: MyInterestsFilters) -> MyInterestsPage:
        interests, total = self.interests.list_by_buyer_id(buyer.id, filters)
        today = datetime.now(BUSINESS_TZ).date()
        return MyInterestsPage.from_params(
            [InterestRead.model_validate(interest) for interest in interests],
            filters,
            total,
            estimated_total=self.interests.estimated_total(buyer.id, filters, today),
        )

    def update(self, public_id: UUID, buyer: Buyer, interest_update: InterestUpdate) -> Interest:
        interest = self.interests.lock_by_public_id(public_id)
        if interest is None:
            raise InterestNotFoundError
        if interest.buyer_id != buyer.id:
            raise NotInterestOwnerUpdateError
        if interest.purchase_status == PurchaseStatus.EM_PROGRESSO:
            raise InterestInPurchaseError

        changes = interest_update.model_dump(exclude_unset=True)
        unit = changes.pop("unit", None)
        if unit is not None and interest.product is not None and unit != interest.product.unit:
            raise ProductUnitChangedError
        reopening = interest.purchase_status == PurchaseStatus.ENTREGUE
        raising = changes.get("quantity", 0) > interest.quantity
        # pedir de novo ou pedir mais segue a regra da criação
        if (reopening or raising) and interest.product_status == UNAVAILABLE:
            raise ProductUnavailableError
        if reopening:
            interest.purchase_part = None
        interest.sqlmodel_update(changes)
        return self.interests.update(interest)

    def delete(self, public_id: UUID, buyer: Buyer) -> None:
        interest = self.interests.get_by_public_id(public_id)
        if interest is None:
            raise InterestNotFoundError
        if interest.buyer_id != buyer.id:
            raise NotInterestOwnerDeleteError
        self.interests.delete(interest)

    def list_apartment_needs(
        self, apartment: Apartment, filters: ApartmentNeedsFilters
    ) -> ApartmentNeedsPage:
        rows, total = self.interests.list_apartment_needs(apartment, filters)
        apartment_needs = [
            ApartmentNeedRead(
                product=ProductDetailRead.model_validate(
                    product, update={"farmer": farmer_summary(product.farmer)}
                ),
                total_quantity=quantity,
                interested_buyers_count=buyers_count,
            )
            for product, quantity, buyers_count in rows
        ]
        return ApartmentNeedsPage.from_params(apartment_needs, filters, total)
