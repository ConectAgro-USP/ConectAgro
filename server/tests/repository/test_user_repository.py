import pytest
from sqlmodel import Session

from src.models.user import User
from src.repository.user_repository import DuplicateUserError, UserRepository


def test_create_commits_user(session: Session):
    users = UserRepository(session)
    user_id = users.create(User(email="ana@example.com", name="Ana Souza")).id

    session.rollback()  # um insert sem commit seria desfeito aqui

    assert users.get_by_id(user_id) is not None


def test_get_by_email_returns_matching_user(session: Session):
    users = UserRepository(session)
    users.create(User(email="ana@example.com", name="Ana Souza"))
    users.create(User(email="bia@example.com", name="Beatriz"))

    user = users.get_by_email("bia@example.com")

    assert user is not None
    assert user.name == "Beatriz"


def test_get_by_email_returns_none_when_missing(session: Session):
    users = UserRepository(session)
    users.create(User(email="ana@example.com", name="Ana Souza"))

    assert users.get_by_email("ninguem@example.com") is None


def test_get_by_id_returns_matching_user(session: Session):
    users = UserRepository(session)
    created = users.create(User(email="ana@example.com", name="Ana Souza"))

    user = users.get_by_id(created.id)

    assert user is not None
    assert user.email == "ana@example.com"


def test_get_by_id_returns_none_when_missing(session: Session):
    users = UserRepository(session)

    assert users.get_by_id(999) is None


def test_create_duplicate_email_raises_and_keeps_session_usable(session: Session):
    users = UserRepository(session)
    users.create(User(email="ana@example.com", name="Ana Souza"))
    duplicate = User(email="ana@example.com", name="Outra Ana")

    with pytest.raises(DuplicateUserError):
        users.create(duplicate)

    assert users.get_by_email("ana@example.com").name == "Ana Souza"
