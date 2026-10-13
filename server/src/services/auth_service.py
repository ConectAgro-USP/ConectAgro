from src.core.security import get_password_hash, verify_password
from src.models.user import User, UserCreate
from src.repository.user_repository import DuplicateUserError, UserRepository
from src.services.exceptions import (
    EmailAlreadyRegisteredError,
    GoogleLoginRejectedError,
    InvalidCredentialsError,
)

_DUMMY_HASH = get_password_hash("senha-que-nunca-confere")


class AuthService:
    def __init__(self, users: UserRepository):
        self.users = users

    def register(self, user_in: UserCreate) -> User:
        if self.users.get_by_email(user_in.email):
            raise EmailAlreadyRegisteredError

        user = User(
            name=user_in.name,
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
        )
        try:
            return self.users.create(user)
        except DuplicateUserError:
            raise EmailAlreadyRegisteredError from None

    def authenticate(self, email: str, password: str) -> User:
        user = self.users.get_by_email(email)
        if user is None or user.hashed_password is None:
            # argon2 mesmo assim, pois sem ele a resposta imediata revela que o e-mail não tem senha
            verify_password(password, _DUMMY_HASH)
            raise InvalidCredentialsError

        if not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError
        return user

    def authenticate_with_google(
        self,
        email: str,
        name: str,
        picture_url: str | None,
        email_verified: bool,
        hosted_domain: str | None = None,
    ) -> User:
        if not email_verified:
            raise GoogleLoginRejectedError

        user = self.users.get_by_email(email)
        if user is None:
            try:
                return self.users.create(User(email=email, name=name, picture_url=picture_url))
            except DuplicateUserError:
                user = self.users.get_by_email(email)

        if user.hashed_password is not None:
            user = self._link_password_account(user, hosted_domain)
        return user

    def _link_password_account(self, user: User, hosted_domain: str | None) -> User:
        # o Google só garante a posse atual do e-mail no Gmail e no Workspace, pela claim hd
        if not (hosted_domain or user.email.endswith("@gmail.com")):
            raise GoogleLoginRejectedError

        # a senha pode ter sido cadastrada por quem não é dono do e-mail, num pré-sequestro de conta
        user.hashed_password = None
        return self.users.save(user)
