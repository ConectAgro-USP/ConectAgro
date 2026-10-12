import pytest
from sqlmodel import Session

from src.models.user import User, UserCreate
from src.repository.user_repository import UserRepository
from src.services.auth_service import AuthService
from src.services.exceptions import EmailAlreadyRegisteredError, InvalidCredentialsError

new_user = UserCreate(name="Cintia", email="cintia@gmail.com", password="#NHJgrej4")


@pytest.fixture()
def users(session: Session) -> UserRepository:
    return UserRepository(session)


@pytest.fixture()
def auth_service(users: UserRepository) -> AuthService:
    return AuthService(users)


def test_register_creates_user_with_hashed_password(
    auth_service: AuthService, users: UserRepository
):
    created = auth_service.register(new_user)

    persisted = users.get_by_email("cintia@gmail.com")
    assert persisted is not None
    assert persisted.id == created.id
    assert persisted.name == "Cintia"
    assert persisted.hashed_password is not None
    assert persisted.hashed_password != "#NHJgrej4"


def test_register_duplicate_email_raises(auth_service: AuthService):
    auth_service.register(new_user)

    with pytest.raises(EmailAlreadyRegisteredError):
        auth_service.register(
            UserCreate(name="Arminda", email="cintia@gmail.com", password="re$-$f56fd")
        )


def test_authenticate_returns_registered_user(auth_service: AuthService):
    created = auth_service.register(new_user)

    user = auth_service.authenticate("cintia@gmail.com", "#NHJgrej4")

    assert user.id == created.id


def test_authenticate_wrong_password_raises(auth_service: AuthService):
    auth_service.register(new_user)

    with pytest.raises(InvalidCredentialsError):
        auth_service.authenticate("cintia@gmail.com", "senha-errada")


def test_authenticate_unknown_email_raises(auth_service: AuthService):
    with pytest.raises(InvalidCredentialsError):
        auth_service.authenticate("ninguem@gmail.com", "#NHJgrej4")


def test_authenticate_google_user_without_password_raises(
    auth_service: AuthService, users: UserRepository
):
    users.create(User(email="google@gmail.com", name="Conta Google"))

    with pytest.raises(InvalidCredentialsError):
        auth_service.authenticate("google@gmail.com", "qualquer-senha")


def test_get_or_create_google_user_creates_new_user(
    auth_service: AuthService, users: UserRepository
):
    user = auth_service.get_or_create_google_user(
        email="google@gmail.com",
        name="Conta Google",
        picture_url="https://example.com/foto.png",
    )

    persisted = users.get_by_email("google@gmail.com")
    assert persisted is not None
    assert persisted.id == user.id
    assert persisted.name == "Conta Google"
    assert persisted.picture_url == "https://example.com/foto.png"
    assert persisted.hashed_password is None


def test_get_or_create_google_user_returns_existing_user(auth_service: AuthService):
    existing = auth_service.register(new_user)

    user = auth_service.get_or_create_google_user(
        email="cintia@gmail.com", name="Outro Nome", picture_url=None
    )

    assert user.id == existing.id
    assert user.name == "Cintia"
