from collections.abc import Generator
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlmodel import Session

from src.core.db import engine
from src.core.security import decode_access_token
from src.models.user import User


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(
    session: SessionDep,
    access_token: Annotated[str | None, Cookie()] = None,
) -> User:
    if access_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")

    payload = decode_access_token(access_token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada")

    user = session.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário não encontrado")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
