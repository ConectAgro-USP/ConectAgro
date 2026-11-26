from unittest.mock import create_autospec
from uuid import uuid4

from sqlalchemy.dialects import postgresql
from sqlmodel import Session

from src.repository.interest_repository import InterestRepository
from src.repository.product_repository import ProductRepository


def mocked_session() -> Session:
    return create_autospec(Session, instance=True)


def executed(session: Session):
    return session.exec.call_args.args[0]


def on_postgres(statement) -> str:
    # sem o dialeto, toda trava sai como FOR UPDATE
    return str(statement.compile(dialect=postgresql.dialect()))


def test_reading_the_product_of_a_new_interest_takes_a_key_share_lock():
    session = mocked_session()

    InterestRepository(session).get_product_by_public_id(uuid4())

    statement = executed(session)
    assert on_postgres(statement).endswith("FOR KEY SHARE")
    assert statement.get_execution_options()["populate_existing"]


def test_reading_an_interest_to_change_it_locks_the_row():
    session = mocked_session()

    InterestRepository(session).lock_by_public_id(uuid4())

    statement = executed(session)
    assert on_postgres(statement).endswith("FOR UPDATE")
    assert statement.get_execution_options()["populate_existing"]


def test_lock_product_locks_the_row():
    session = mocked_session()

    ProductRepository(session).lock_product(1)

    assert on_postgres(executed(session)).endswith("FOR UPDATE")
