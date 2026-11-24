from uuid import UUID

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.interest import (
    ApartmentNeedRead,
    Interest,
    InterestCreate,
    InterestUpdate,
)
from src.models.product import UNAVAILABLE, ProductDetailRead
from src.models.purchase import PurchaseStatus
from src.repository.interest_repository import InterestGoneError, InterestRepository
from src.repository.profile_repository import DuplicateValueError
from src.services.exceptions import (
    InterestAlreadyExistsError,
    InterestInPurchaseError,
    InterestNotFoundError,
    NotInterestOwnerDeleteError,
    NotInterestOwnerUpdateError,
    ProductNotFoundError,
    ProductUnavailableError,
)
from src.services.product_service import _farmer_summary


class InterestService:
    def __init__(self, interests: InterestRepository):
        self.interests = interests

    def create(self, buyer: Buyer, interest_in: InterestCreate) -> Interest:
        product = self.interests.get_product_by_public_id(interest_in.product_public_id)
        if product is None:
            raise ProductNotFoundError
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

    def list_interests(self, buyer: Buyer) -> list[Interest]:
        return self.interests.list_by_buyer_id(buyer.id)

    def update(self, public_id: UUID, buyer: Buyer, interest_update: InterestUpdate) -> Interest:
        interest = self.interests.lock_by_public_id(public_id)
        if interest is None:
            raise InterestNotFoundError
        if interest.buyer_id != buyer.id:
            raise NotInterestOwnerUpdateError
        if interest.purchase_status == PurchaseStatus.EM_PROGRESSO:
            raise InterestInPurchaseError

        changes = interest_update.model_dump(exclude_unset=True)
        reopening = interest.purchase_status == PurchaseStatus.ENTREGUE
        raising = changes.get("quantity", 0) > interest.quantity
        # pedir de novo ou pedir mais segue a regra da criação
        if (reopening or raising) and interest.product_status == UNAVAILABLE:
            raise ProductUnavailableError
        if reopening:
            interest.purchase_part = None
        interest.sqlmodel_update(changes)
        try:
            return self.interests.update(interest)
        except InterestGoneError:
            # o morador pode apagar o interesse em outra aba durante a edição
            raise InterestNotFoundError from None

    def delete(self, public_id: UUID, buyer: Buyer) -> None:
        interest = self.interests.get_by_public_id(public_id)
        if interest is None:
            raise InterestNotFoundError
        if interest.buyer_id != buyer.id:
            raise NotInterestOwnerDeleteError
        self.interests.delete(interest)

    def list_apartment_needs(
        self, apartment: Apartment, descending: bool = True
    ) -> list[ApartmentNeedRead]:
        rows = self.interests.list_apartment_needs(apartment, descending=descending)
        apartment_needs = [
            ApartmentNeedRead(
                product=ProductDetailRead.model_validate(
                    product, update={"farmer": _farmer_summary(product.farmer)}
                ),
                total_quantity=quantity,
                interested_buyers_count=buyers_count,
            )
            for product, quantity, buyers_count in rows
        ]
        return apartment_needs
