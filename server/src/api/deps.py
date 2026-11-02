from collections.abc import Generator
from typing import Annotated

import httpx
from fastapi import Cookie, Depends, HTTPException, status
from sqlmodel import Session

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.cnpja import CnpjaConnector
from src.core.db import engine
from src.core.security import decode_access_token
from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.user import User
from src.repository.profile_repository import ProfileRepository
from src.repository.user_repository import UserRepository
from src.services.apartment_service import ApartmentService
from src.services.auth_service import AuthService
from src.services.cnpj_service import CnpjService
from src.services.exceptions import LinkPendingError, LinkRejectedError, ProfileNotFoundError
from src.services.profile_service import ProfileService

# um client só, dividido entre as threads, reaproveita as conexões abertas
http_client = httpx.Client()


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


def get_brasilapi_connector() -> BrasilApiConnector:
    return BrasilApiConnector(http_client)


BrasilApiDep = Annotated[BrasilApiConnector, Depends(get_brasilapi_connector)]


def get_cnpja_connector() -> CnpjaConnector:
    return CnpjaConnector(http_client)


CnpjaDep = Annotated[CnpjaConnector, Depends(get_cnpja_connector)]


def get_profile_repository(session: SessionDep) -> ProfileRepository:
    return ProfileRepository(session)


ProfileRepositoryDep = Annotated[ProfileRepository, Depends(get_profile_repository)]


def get_profile_service(
    profiles: ProfileRepositoryDep, ceps: BrasilApiDep, companies: CnpjaDep
) -> ProfileService:
    return ProfileService(profiles, ceps, CnpjService(companies))


ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]


def get_apartment_service(profiles: ProfileRepositoryDep) -> ApartmentService:
    return ApartmentService(profiles)


ApartmentServiceDep = Annotated[ApartmentService, Depends(get_apartment_service)]


def get_current_farmer(current_user: CurrentUser, profile_service: ProfileServiceDep) -> Farmer:
    try:
        return profile_service.get_farmer(current_user)
    except ProfileNotFoundError:
        message = "Acesso permitido apenas para agricultores"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None


CurrentFarmer = Annotated[Farmer, Depends(get_current_farmer)]


def get_current_apartment(
    current_user: CurrentUser, profile_service: ProfileServiceDep
) -> Apartment:
    try:
        return profile_service.get_apartment(current_user)
    except ProfileNotFoundError:
        message = "Acesso permitido apenas para síndicos"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None


CurrentApartment = Annotated[Apartment, Depends(get_current_apartment)]


def get_current_buyer(current_user: CurrentUser, profile_service: ProfileServiceDep) -> Buyer:
    try:
        return profile_service.get_approved_buyer(current_user)
    except ProfileNotFoundError:
        message = "Acesso permitido apenas para moradores"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None
    except LinkPendingError:
        message = "Seu vínculo com o prédio está aguardando aprovação do síndico"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None
    except LinkRejectedError:
        message = "Seu vínculo com o prédio foi recusado pelo síndico"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None


CurrentBuyer = Annotated[Buyer, Depends(get_current_buyer)]
