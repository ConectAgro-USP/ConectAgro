from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import create_autospec
from uuid import uuid4

import pytest

from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.interest import (
    ApartmentNeedsFilters,
    Interest,
    InterestCreate,
    InterestUpdate,
    MyInterestsFilters,
)
from src.models.product import Product
from src.repository.interest_repository import InterestRepository
from src.services.exceptions import (
    InterestAlreadyExistsError,
    InterestNotFoundError,
    NotInterestOwnerDeleteError,
    NotInterestOwnerUpdateError,
    ProductNotFoundError,
)
from src.services.interests_service import InterestService


@pytest.fixture
def buyer() -> Buyer:
    return Buyer(id=7, user_id=101, unit="42")


@pytest.fixture
def product() -> Product:
    return Product(
        id=19,
        name="Tomate",
        quantity=12,
        price=Decimal("3.00"),
        expiration_date=date.today() + timedelta(days=5),
        farmer_id=23,
    )


@pytest.fixture
def interests() -> InterestRepository:
    return create_autospec(InterestRepository, instance=True)


@pytest.fixture
def service(interests: InterestRepository) -> InterestService:
    return InterestService(interests)


def test_create_uses_buyer_profile_and_product_ids(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
    product: Product,
):
    interests.lock_product_by_public_id.return_value = product
    interests.get_by_buyer_and_product.return_value = None
    interest_in = InterestCreate(product_public_id=product.public_id, quantity=3)

    created = service.create(buyer, interest_in)

    interests.lock_product_by_public_id.assert_called_once_with(product.public_id)
    interests.get_by_buyer_and_product.assert_called_once_with(buyer, product)
    interests.create.assert_called_once()
    saved_interest = interests.create.call_args.args[0]
    assert saved_interest.buyer_id == buyer.id
    assert saved_interest.product_id == product.id
    assert saved_interest.product_public_id_snapshot == product.public_id
    assert saved_interest.product_name_snapshot == product.name
    assert saved_interest.product is product
    assert saved_interest.quantity == 3
    assert created is saved_interest


def test_create_rejects_unknown_product(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
):
    interests.lock_product_by_public_id.return_value = None

    with pytest.raises(ProductNotFoundError):
        service.create(buyer, InterestCreate(quantity=1, product_public_id=uuid4()))

    interests.create.assert_not_called()


def test_create_rejects_duplicate_buyer_product_pair(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
    product: Product,
):
    interests.lock_product_by_public_id.return_value = product
    interests.get_by_buyer_and_product.return_value = Interest(
        quantity=1, buyer_id=buyer.id, product_id=product.id
    )

    with pytest.raises(InterestAlreadyExistsError):
        service.create(buyer, InterestCreate(quantity=2, product_public_id=product.public_id))

    interests.create.assert_not_called()


def test_list_interests_uses_buyer_profile_id(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
):
    filters = MyInterestsFilters()
    interests.list_by_buyer_id.return_value = ([], 0)
    interests.estimated_total.return_value = Decimal("0.00")

    service.list_interests(buyer, filters)

    interests.list_by_buyer_id.assert_called_once_with(buyer.id, filters)


def test_update_changes_quantity_for_owner(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
    product: Product,
):
    interest = Interest(quantity=1, buyer_id=buyer.id, product_id=product.id, product=product)
    public_id = uuid4()
    interests.lock_by_public_id.return_value = interest
    interests.update.return_value = interest

    result = service.update(public_id, buyer, InterestUpdate(quantity=4))

    interests.lock_by_public_id.assert_called_once_with(public_id)
    assert interest.quantity == 4
    interests.update.assert_called_once_with(interest)
    assert result is interest


def test_update_rejects_unknown_interest(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
):
    interests.lock_by_public_id.return_value = None

    with pytest.raises(InterestNotFoundError):
        service.update(uuid4(), buyer, InterestUpdate(quantity=4))

    interests.update.assert_not_called()


def test_update_rejects_another_buyers_interest(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
    product: Product,
):
    interests.lock_by_public_id.return_value = Interest(
        quantity=1, buyer_id=buyer.id + 1, product_id=product.id
    )

    with pytest.raises(NotInterestOwnerUpdateError):
        service.update(uuid4(), buyer, InterestUpdate(quantity=4))

    interests.update.assert_not_called()


def test_delete_removes_interest_for_owner(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
    product: Product,
):
    interest = Interest(quantity=1, buyer_id=buyer.id, product_id=product.id)
    public_id = uuid4()
    interests.get_by_public_id.return_value = interest

    service.delete(public_id, buyer)

    interests.get_by_public_id.assert_called_once_with(public_id)
    interests.delete.assert_called_once_with(interest)


def test_delete_rejects_another_buyers_interest(
    service: InterestService,
    interests: InterestRepository,
    buyer: Buyer,
    product: Product,
):
    interest = Interest(quantity=1, buyer_id=buyer.id + 1, product_id=product.id)
    interests.get_by_public_id.return_value = interest

    with pytest.raises(NotInterestOwnerDeleteError):
        service.delete(uuid4(), buyer)

    interests.delete.assert_not_called()


@pytest.mark.parametrize("descending", [True, False])
def test_apartment_needs_forwards_sort_direction(
    service: InterestService,
    interests: InterestRepository,
    descending: bool,
):
    apartment = Apartment(
        id=31,
        manager_id=41,
        zip_code="01310200",
        building_name="Edifício Teste",
        building_cnpj="00000000000191",
    )

    filters = ApartmentNeedsFilters(descending=descending)
    interests.list_apartment_needs.return_value = ([], 0)

    service.list_apartment_needs(apartment, filters)

    interests.list_apartment_needs.assert_called_once_with(apartment, filters)
