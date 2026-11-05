from collections.abc import Generator
from typing import Annotated

import httpx
from fastapi import Cookie, Depends, HTTPException, status
from sqlmodel import Session

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.osrm import OsrmConnector
from src.core.db import engine
from src.core.security import decode_access_token
from src.models.user import User
from src.repository.farmer_search_repository import FarmerSearchRepository
from src.repository.user_repository import UserRepository
from src.services.auth_service import AuthService
from src.services.distance_service import DistanceService
from src.services.farmer_search_service import FarmerSearchService


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


def get_user_repository(session: SessionDep) -> UserRepository:
    return UserRepository(session)


UserRepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]


def get_auth_service(users: UserRepositoryDep) -> AuthService:
    return AuthService(users)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def get_current_user(
    users: UserRepositoryDep,
    access_token: Annotated[str | None, Cookie()] = None,
) -> User:
    if access_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")

    user_id = decode_access_token(access_token)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada")

    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário não encontrado")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_distance_service() -> DistanceService:
    client = httpx.Client()
    return DistanceService(BrasilApiConnector(client), OsrmConnector(client))


DistanceServiceDep = Annotated[DistanceService, Depends(get_distance_service)]


def get_farmer_search_repository(session: SessionDep) -> FarmerSearchRepository:
    return FarmerSearchRepository(session)


FarmerSearchRepositoryDep = Annotated[
    FarmerSearchRepository, Depends(get_farmer_search_repository)
]


def get_farmer_search_service(
    repository: FarmerSearchRepositoryDep,
    distance_service: DistanceServiceDep,
) -> FarmerSearchService:
    return FarmerSearchService(repository, distance_service)


FarmerSearchServiceDep = Annotated[FarmerSearchService, Depends(get_farmer_search_service)]