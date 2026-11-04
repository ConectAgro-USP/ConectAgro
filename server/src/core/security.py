import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from src.core.config import settings


@dataclass(frozen=True)
class TokenData:
    user_id: int
    session_version: int


def create_access_token(user_id: int, session_version: int) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "ver": session_version, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> TokenData | None:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub", "ver"]},
        )
        return TokenData(user_id=int(payload["sub"]), session_version=int(payload["ver"]))
    except (jwt.PyJWTError, TypeError, ValueError):
        return None


# parâmetros mínimos da OWASP, com 19 MiB por hash em vez de 64 MiB, para caber na RAM
password_hash = PasswordHash((Argon2Hasher(memory_cost=19456, time_cost=2, parallelism=1),))
# cada argon2 aloca a memória gravada no hash, 64 MiB nos antigos, então limita o pico de RAM
_ARGON2_SLOTS = threading.BoundedSemaphore(4)


def verify_password(plain_password, hashed_password):
    with _ARGON2_SLOTS:
        return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password):
    with _ARGON2_SLOTS:
        return password_hash.hash(password)
