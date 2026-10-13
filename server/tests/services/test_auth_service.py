from unittest.mock import Mock

import pytest
from pwdlib import PasswordHash
from sqlmodel import Session

from src.models.user import User, UserCreate
from src.repository.user_repository import UserRepository
from src.services.auth_service import AuthService
from src.services.exceptions import (
    EmailAlreadyRegisteredError,
    GoogleLoginRejectedError,
    InvalidCredentialsError,
)

cintia_signup = UserCreate(name="Cintia", email="cintia@gmail.com", password="#NHJgrej4")


@pytest.fixture()
def users(session: Session) -> UserRepository:
    return UserRepository(session)


@pytest.fixture()
def auth_service(users: UserRepository) -> AuthService:
    return AuthService(users)


def test_register_creates_user_with_hashed_password(
    auth_service: AuthService, users: UserRepository
):
    created = auth_service.register(cintia_signup)

    persisted = users.get_by_email("cintia@gmail.com")
    assert persisted is not None
    assert persisted.id == created.id
    assert persisted.name == "Cintia"
    assert persisted.hashed_password is not None
    assert persisted.hashed_password != "#NHJgrej4"


def test_register_duplicate_email_raises(auth_service: AuthService):
    auth_service.register(cintia_signup)

    with pytest.raises(EmailAlreadyRegisteredError):
        auth_service.register(
            UserCreate(name="Arminda", email="cintia@gmail.com", password="re$-$f56fd")
        )


def test_register_duplicate_email_race_raises(
    auth_service: AuthService, users: UserRepository, monkeypatch: pytest.MonkeyPatch
):
    auth_service.register(cintia_signup)
    monkeypatch.setattr(users, "get_by_email", lambda email: None)

    with pytest.raises(EmailAlreadyRegisteredError):
        auth_service.register(cintia_signup)


def test_authenticate_returns_registered_user(auth_service: AuthService):
    created = auth_service.register(cintia_signup)

    user = auth_service.authenticate("cintia@gmail.com", "#NHJgrej4")

    assert user.id == created.id


def test_authenticate_keeps_password_saved_with_old_parameters(
    auth_service: AuthService, users: UserRepository
):
    # regravar a senha no login desfaria um vínculo Google concorrente, que a apaga
    old_hash = PasswordHash.recommended().hash("#NHJgrej4")
    users.create(User(email="cintia@gmail.com", name="Cintia", hashed_password=old_hash))

    auth_service.authenticate("cintia@gmail.com", "#NHJgrej4")

    assert users.get_by_email("cintia@gmail.com").hashed_password == old_hash


def test_authenticate_wrong_password_raises(auth_service: AuthService):
    auth_service.register(cintia_signup)

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


@pytest.mark.parametrize("email", ["google@gmail.com", "ninguem@gmail.com"])
def test_authenticate_runs_argon2_even_without_password(
    email: str, auth_service: AuthService, users: UserRepository, monkeypatch: pytest.MonkeyPatch
):
    users.create(User(email="google@gmail.com", name="Conta Google"))
    verify = Mock(return_value=False)
    monkeypatch.setattr("src.services.auth_service.verify_password", verify)

    with pytest.raises(InvalidCredentialsError):
        auth_service.authenticate(email, "qualquer-senha")

    verify.assert_called_once()


def test_authenticate_with_google_creates_new_user(
    auth_service: AuthService, users: UserRepository
):
    user = auth_service.authenticate_with_google(
        email="google@gmail.com",
        name="Conta Google",
        picture_url="https://example.com/foto.png",
        email_verified=True,
    )

    persisted = users.get_by_email("google@gmail.com")
    assert persisted is not None
    assert persisted.id == user.id
    assert persisted.name == "Conta Google"
    assert persisted.picture_url == "https://example.com/foto.png"
    assert persisted.hashed_password is None


def test_authenticate_with_google_returns_existing_google_user(
    auth_service: AuthService, users: UserRepository
):
    existing = users.create(User(email="google@gmail.com", name="Conta Google"))

    user = auth_service.authenticate_with_google(
        email="google@gmail.com", name="Outro Nome", picture_url=None, email_verified=True
    )

    assert user.id == existing.id
    assert user.name == "Conta Google"


@pytest.mark.parametrize(
    "email, hosted_domain",
    [("cintia@gmail.com", None), ("cintia@empresa.com.br", "empresa.com.br")],
    ids=["gmail", "workspace"],
)
def test_authenticate_with_google_links_password_account_and_clears_password(
    email: str,
    hosted_domain: str | None,
    auth_service: AuthService,
    users: UserRepository,
    session: Session,
):
    existing = auth_service.register(UserCreate(name="Cintia", email=email, password="#NHJgrej4"))

    user = auth_service.authenticate_with_google(
        email=email,
        name="Outro Nome",
        picture_url=None,
        email_verified=True,
        hosted_domain=hosted_domain,
    )

    assert user.id == existing.id
    session.rollback()  # um update sem commit seria desfeito aqui
    assert users.get_by_email(email).hashed_password is None


def test_authenticate_with_google_keeps_password_when_google_is_not_authoritative(
    auth_service: AuthService,
):
    existing = auth_service.register(
        UserCreate(name="Maria", email="maria@empresa.com.br", password="#NHJgrej4")
    )

    with pytest.raises(GoogleLoginRejectedError):
        auth_service.authenticate_with_google(
            email="maria@empresa.com.br", name="Maria", picture_url=None, email_verified=True
        )

    assert auth_service.authenticate("maria@empresa.com.br", "#NHJgrej4").id == existing.id


def test_authenticate_with_google_rejects_unverified_email(
    auth_service: AuthService, users: UserRepository
):
    with pytest.raises(GoogleLoginRejectedError):
        auth_service.authenticate_with_google(
            email="google@gmail.com", name="Conta Google", picture_url=None, email_verified=False
        )

    assert users.get_by_email("google@gmail.com") is None


def test_authenticate_with_google_returns_user_created_concurrently(
    auth_service: AuthService, users: UserRepository, monkeypatch: pytest.MonkeyPatch
):
    concurrent = users.create(User(email="google@gmail.com", name="Conta Google"))
    monkeypatch.setattr(users, "get_by_email", Mock(side_effect=[None, concurrent]))

    user = auth_service.authenticate_with_google(
        email="google@gmail.com", name="Outra Aba", picture_url=None, email_verified=True
    )

    assert user.id == concurrent.id
