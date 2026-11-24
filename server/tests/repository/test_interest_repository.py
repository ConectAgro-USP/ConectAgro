from uuid import uuid4

import pytest
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.interest import Interest, MyInterestsFilters
from src.repository.interest_repository import InterestRepository
from tests.helpers import (
    add_farmer,
    add_product,
    add_resident,
    add_user,
)


@pytest.fixture
def interest_repository(session: Session) -> InterestRepository:
    return InterestRepository(session)


@pytest.fixture
def buyer(session: Session, building: Apartment):
    return add_resident(
        session,
        building,
        add_user(session, "buyer@example.com"),
        link_status=LinkStatus.APROVADO,
    )


def _add_interest(
    session: Session, buyer_id: int, product_id: int, quantity: int
) -> Interest:
    interest = Interest(
        buyer_id=buyer_id,
        product_id=product_id,
        quantity=quantity,
    )
    session.add(interest)
    session.commit()
    session.refresh(interest)
    return interest


def test_list_by_buyer_id_returns_only_requested_buyers_interests(
    session: Session,
    building: Apartment,
    buyer,
    interest_repository: InterestRepository,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    other_buyer = add_resident(
        session,
        building,
        add_user(session, "other-buyer@example.com"),
        link_status=LinkStatus.APROVADO,
    )
    product = add_product(session, farmer)
    other_product = add_product(session, farmer, name="Couve")
    buyer_interest = _add_interest(session, buyer.id, product.id, quantity=2)
    _add_interest(session, other_buyer.id, other_product.id, quantity=3)

    interests, total = interest_repository.list_by_buyer_id(buyer.id, MyInterestsFilters())

    assert interests == [buyer_interest]
    assert total == 1


def test_get_product_by_public_id_returns_none_for_unknown_product(
    interest_repository: InterestRepository,
):
    assert interest_repository.get_product_by_public_id(uuid4()) is None


def test_interest_lookups_find_existing_rows_by_public_id_and_pair(
    session: Session,
    buyer,
    interest_repository: InterestRepository,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    product = add_product(session, farmer)
    interest = _add_interest(session, buyer.id, product.id, quantity=2)
    assert interest_repository.get_product_by_public_id(product.public_id) == product
    assert interest_repository.get_by_public_id(interest.public_id) == interest
    assert interest_repository.get_by_buyer_and_product(buyer, product) == interest


def test_interest_lookups_return_none_when_rows_do_not_exist(
    session: Session,
    buyer,
    interest_repository: InterestRepository,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    product = add_product(session, farmer)
    assert interest_repository.get_by_public_id(uuid4()) is None
    assert interest_repository.get_by_buyer_and_product(buyer, product) is None