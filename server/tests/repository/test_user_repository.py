from sqlmodel import Session

from src.models.user import User
from src.repository.user_repository import UserRepository


def test_create_persists_user(session: Session):
    users = UserRepository(session)

    created = users.create(User(email="ana@example.com", name="Ana Souza"))

    assert created.id is not None
    with Session(session.get_bind()) as other_session:
        persisted = other_session.get(User, created.id)
    assert persisted is not None
    assert persisted.email == "ana@example.com"


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
