from unittest.mock import create_autospec
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from src.models.user import User
from src.repository.profile_repository import DuplicateValueError, ProfileRepository


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


def test_commit_turns_an_integrity_error_into_duplicate_value_error():
    session = create_autospec(Session, instance=True)
    integrity_error = IntegrityError("UPDATE users", {}, Exception("unique"))
    session.commit.side_effect = integrity_error

    with pytest.raises(DuplicateValueError) as caught:
        ProfileRepository(session).commit()

    session.rollback.assert_called_once_with()
    assert caught.value.__cause__ is integrity_error
