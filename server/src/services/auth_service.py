from src.core.security import get_password_hash, verify_password
from src.models.user import User, UserCreate
from src.repository.user_repository import UserRepository
from src.services.exceptions import EmailAlreadyRegisteredError, InvalidCredentialsError


class AuthService:
    def __init__(self, users: UserRepository):
        self.users = users

    def register(self, user_in: UserCreate) -> User:
        if self.users.get_by_email(user_in.email):
            raise EmailAlreadyRegisteredError

        return self.users.create(
            User(
                name=user_in.name,
                email=user_in.email,
                hashed_password=get_password_hash(user_in.password),
            )
        )

    def authenticate(self, email: str, password: str) -> User:
        user = self.users.get_by_email(email)

        if (
            user is None
            or user.hashed_password is None
            or not verify_password(password, user.hashed_password)
        ):
            raise InvalidCredentialsError

        return user

    def get_or_create_google_user(self, email: str, name: str, picture_url: str | None) -> User:
        user = self.users.get_by_email(email)
        if user is not None:
            return user

        return self.users.create(User(email=email, name=name, picture_url=picture_url))
