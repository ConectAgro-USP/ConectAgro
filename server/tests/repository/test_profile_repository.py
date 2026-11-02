from unittest.mock import create_autospec
from uuid import uuid4

from sqlmodel import Session

from src.models.user import User
from src.repository.profile_repository import ProfileRepository


def test_lock_buyer_of_apartment_locks_the_row():
    session = create_autospec(Session, instance=True)

    ProfileRepository(session).lock_buyer_of_apartment(uuid4(), 1)

    statement = session.exec.call_args.args[0]
    assert str(statement).endswith("FOR UPDATE")


def test_lock_and_reload_locks_the_row():
    session = create_autospec(Session, instance=True)
    user = User(email="ana@example.com", name="Ana Souza")

    ProfileRepository(session).lock_and_reload(user)

    session.refresh.assert_called_once_with(user, with_for_update=True)
