from datetime import UTC, datetime
from uuid import UUID

from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, INT4_MAX
from src.models.purchase import (
    Purchase,
    PurchaseCreate,
    PurchasePart,
    PurchaseProduct,
    PurchaseRead,
    PurchaseStatus,
)
from src.models.user import User
from src.repository.purchase_repository import PurchaseRepository
from src.services.exceptions import (
    ProductExpiredError,
    ProductNotFoundError,
    ProductOutOfStockError,
    PurchaseAccessDeniedError,
    PurchaseAlreadyDeliveredError,
    PurchaseNotFoundError,
    PurchasePartClosedError,
)


class PurchaseService:
    def __init__(self, purchases: PurchaseRepository):
        self.purchases = purchases

    def create(self, apartment: Apartment, purchase_in: PurchaseCreate) -> Purchase:
        quantities = {}
        for item in purchase_in.items:
            quantities[item.product_public_id] = item.quantity
        products = self.purchases.lock_products(list(quantities))
        if len(products) != len(quantities):
            raise ProductNotFoundError

        today = datetime.now(BUSINESS_TZ).date()
        purchase = Purchase(
            apartment_id=apartment.id,
            expected_delivery_date=purchase_in.expected_delivery_date,
        )
        parts = {}
        for product in products:
            quantity = quantities[product.public_id]
            if product.expiration_date < today:
                raise ProductExpiredError(product.name)
            if product.quantity < quantity:
                raise ProductOutOfStockError(product.name)
            product.quantity -= quantity
            if product.farmer_id not in parts:
                part = PurchasePart(farmer_id=product.farmer_id)
                parts[product.farmer_id] = part
                purchase.purchase_parts.append(part)
            purchase_product = PurchaseProduct(
                product=product, quantity=quantity, unit_price=product.price
            )
            parts[product.farmer_id].purchase_products.append(purchase_product)

        self.purchases.add(purchase)
        self.purchases.commit()
        return self.purchases.get_by_public_id(purchase.public_id)

    def get_purchase(self, public_id: UUID, user: User) -> PurchaseRead:
        purchase = self.purchases.get_by_public_id(public_id)
        if purchase is None:
            raise PurchaseNotFoundError
        if user.apartment is not None and user.apartment.id == purchase.apartment_id:
            return PurchaseRead.model_validate(purchase)
        part = _part_of_farmer(purchase, user.farmer)
        if part is None:
            raise PurchaseAccessDeniedError
        # o agricultor vê só a própria parte
        return PurchaseRead.model_validate(purchase, update={"purchase_parts": [part]})

    def change_own_part_status(
        self, public_id: UUID, farmer: Farmer, new_status: PurchaseStatus
    ) -> PurchasePart:
        purchase = self._lock_purchase(public_id)
        part = _part_of_farmer(purchase, farmer)
        if part is None:
            raise PurchaseAccessDeniedError
        if part.status != PurchaseStatus.EM_PROGRESSO:
            raise PurchasePartClosedError
        self._close_parts(purchase, [part], new_status)
        return part

    def cancel(self, public_id: UUID, apartment: Apartment) -> Purchase:
        purchase = self._lock_purchase(public_id)
        if purchase.apartment_id != apartment.id:
            raise PurchaseAccessDeniedError
        open_parts = []
        for part in purchase.purchase_parts:
            if part.status == PurchaseStatus.ENTREGUE:
                raise PurchaseAlreadyDeliveredError
            if part.status == PurchaseStatus.EM_PROGRESSO:
                open_parts.append(part)
        self._close_parts(purchase, open_parts, PurchaseStatus.CANCELADA)
        return purchase

    def _lock_purchase(self, public_id: UUID) -> Purchase:
        purchase = self.purchases.lock_by_public_id(public_id)
        if purchase is None:
            raise PurchaseNotFoundError
        return purchase

    def _close_parts(
        self, purchase: Purchase, parts: list[PurchasePart], new_status: PurchaseStatus
    ) -> None:
        if new_status == PurchaseStatus.CANCELADA:
            self._return_stock(parts)
        now = datetime.now(UTC)
        for part in parts:
            part.status = new_status
            part.closed_at = now
        # a compra só fecha com todas as partes no mesmo status
        if purchase.closed_at is None and purchase.status != PurchaseStatus.EM_PROGRESSO:
            purchase.closed_at = now
        self.purchases.commit()

    def _return_stock(self, parts: list[PurchasePart]) -> None:
        quantities = {}
        for part in parts:
            for item in part.purchase_products:
                quantities[item.product_public_id] = item.quantity
        for product in self.purchases.lock_products(list(quantities)):
            new_quantity = product.quantity + quantities[product.public_id]
            # o estoque não pode passar do limite da coluna
            product.quantity = min(new_quantity, INT4_MAX)


def _part_of_farmer(purchase: Purchase, farmer: Farmer | None) -> PurchasePart | None:
    if farmer is None:
        return None
    for part in purchase.purchase_parts:
        if part.farmer_id == farmer.id:
            return part
    return None
