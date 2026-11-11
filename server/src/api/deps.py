from collections.abc import Generator
from typing import Annotated

import httpx
from fastapi import Cookie, Depends, HTTPException, status
from sqlmodel import Session

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.cnpja import CnpjaConnector
from src.connectors.osrm import OsrmConnector
from src.core.db import engine
from src.core.security import decode_access_token
from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.user import User
from src.repository.farmer_search_repository import FarmerSearchRepository
from src.repository.product_repository import ProductRepository
from src.repository.profile_repository import ProfileRepository
from src.repository.purchase_repository import PurchaseRepository
from src.repository.user_repository import UserRepository
from src.services.apartment_service import ApartmentService
from src.services.auth_service import AuthService
from src.services.cnpj_service import CnpjService
from src.services.company_cache import CompanyCache
from src.services.distance_service import DistanceService
from src.services.farmer_search_service import FarmerSearchService
from src.services.product_search_service import ProductSearchService
from src.services.product_service import ProductService
from src.services.profile_service import ProfileService
from src.services.purchase_service import PurchaseService

# um client só, dividido entre as threads, reaproveita as conexões abertas
http_client = httpx.Client()
# a CNPJá aceita poucas consultas: a prévia e o cadastro gastam uma só
RECENT_COMPANIES = CompanyCache(keep_seconds=60 * 60)


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

    token_data = decode_access_token(access_token)
    if token_data is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada")

    user = users.get_by_id(token_data.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário não encontrado")
    if token_data.session_version != user.session_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada")

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
    return ProfileService(profiles, ceps, CnpjService(companies, RECENT_COMPANIES))


ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]


def get_apartment_service(profiles: ProfileRepositoryDep) -> ApartmentService:
    return ApartmentService(profiles)


ApartmentServiceDep = Annotated[ApartmentService, Depends(get_apartment_service)]


def get_product_repository(session: SessionDep) -> ProductRepository:
    return ProductRepository(session)


ProductRepositoryDep = Annotated[ProductRepository, Depends(get_product_repository)]


def get_product_service(products: ProductRepositoryDep) -> ProductService:
    return ProductService(products)


ProductServiceDep = Annotated[ProductService, Depends(get_product_service)]


def get_product_search_service(products: ProductRepositoryDep) -> ProductSearchService:
    return ProductSearchService(products)


ProductSearchServiceDep = Annotated[ProductSearchService, Depends(get_product_search_service)]


def get_purchase_repository(session: SessionDep) -> PurchaseRepository:
    return PurchaseRepository(session)


PurchaseRepositoryDep = Annotated[PurchaseRepository, Depends(get_purchase_repository)]


def get_purchase_service(purchases: PurchaseRepositoryDep) -> PurchaseService:
    return PurchaseService(purchases)


PurchaseServiceDep = Annotated[PurchaseService, Depends(get_purchase_service)]


def get_current_farmer(current_user: CurrentUser) -> Farmer:
    if current_user.farmer is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso permitido apenas para agricultores")
    return current_user.farmer


CurrentFarmer = Annotated[Farmer, Depends(get_current_farmer)]


def get_current_apartment(current_user: CurrentUser) -> Apartment:
    if current_user.apartment is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso permitido apenas para síndicos")
    return current_user.apartment


CurrentApartment = Annotated[Apartment, Depends(get_current_apartment)]


def get_current_buyer(current_user: CurrentUser) -> Buyer:
    buyer = current_user.buyer
    if buyer is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso permitido apenas para moradores")
    if buyer.link_status == LinkStatus.PENDENTE:
        message = "Seu vínculo com o prédio está aguardando aprovação do síndico"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message)
    if buyer.link_status != LinkStatus.APROVADO:
        message = "Seu vínculo com o prédio foi recusado pelo síndico"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message)
    return buyer


CurrentBuyer = Annotated[Buyer, Depends(get_current_buyer)]


def get_osrm_connector() -> OsrmConnector:
    return OsrmConnector(http_client)


OsrmDep = Annotated[OsrmConnector, Depends(get_osrm_connector)]


def get_distance_service(ceps: BrasilApiDep, routes: OsrmDep) -> DistanceService:
    return DistanceService(ceps, routes)


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


def get_current_building_zip_code(current_user: CurrentUser) -> str:
    # o síndico usa o CEP do seu prédio, o morador usa o do prédio que o aprovou
    if current_user.apartment is not None:
        return current_user.apartment.zip_code
    if current_user.buyer is None or current_user.buyer.apartment is None:
        message = "Acesso permitido apenas para moradores e síndicos"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message)
    return get_current_buyer(current_user).apartment.zip_code


BuildingZipCode = Annotated[str, Depends(get_current_building_zip_code)]
