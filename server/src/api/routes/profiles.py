from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import CurrentUser, ProfileServiceDep, get_current_user
from src.api.rate_limits import limit_profile_requests
from src.models.profile import (
    ApartmentCreate,
    ApartmentPreview,
    BuyerCreate,
    Cnpj,
    FarmerCreate,
    ProfileRead,
    ProfileUpdate,
)
from src.services.exceptions import (
    ApartmentNotFoundError,
    CepNotFoundError,
    CepWithoutCoordinatesError,
    CnpjNotActiveError,
    CnpjNotFoundError,
    CpfAlreadyRegisteredError,
    ExternalServiceError,
    FieldNotInProfileError,
    InvalidCepError,
    InvalidCnpjError,
    ProfileAlreadyExistsError,
    RateLimitedError,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])

HTTP_ERRORS = {
    ProfileAlreadyExistsError: (status.HTTP_409_CONFLICT, "Você já tem um perfil"),
    CpfAlreadyRegisteredError: (status.HTTP_409_CONFLICT, "CPF já cadastrado"),
    ApartmentNotFoundError: (status.HTTP_422_UNPROCESSABLE_CONTENT, "Prédio não encontrado"),
    InvalidCepError: (status.HTTP_422_UNPROCESSABLE_CONTENT, "CEP inválido"),
    CepNotFoundError: (status.HTTP_422_UNPROCESSABLE_CONTENT, "CEP não encontrado"),
    CepWithoutCoordinatesError: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Não foi possível localizar este CEP. Informe um CEP próximo",
    ),
    ExternalServiceError: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Não foi possível consultar o CEP ou o CNPJ agora. Tente novamente mais tarde",
    ),
    InvalidCnpjError: (status.HTTP_422_UNPROCESSABLE_CONTENT, "CNPJ inválido"),
    CnpjNotFoundError: (status.HTTP_422_UNPROCESSABLE_CONTENT, "CNPJ não encontrado"),
    CnpjNotActiveError: (status.HTTP_422_UNPROCESSABLE_CONTENT, "CNPJ não está ativo"),
    RateLimitedError: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Não foi possível consultar o CNPJ agora. Tente novamente mais tarde",
    ),
}
PROFILE_ERRORS = tuple(HTTP_ERRORS.keys())


def http_error(error: Exception) -> HTTPException:
    status_code, message = HTTP_ERRORS[type(error)]
    return HTTPException(status_code, message)


# def e não async, para o FastAPI rodar o banco e as APIs externas no threadpool
@router.post(
    "/farmer",
    status_code=status.HTTP_201_CREATED,
    response_model=ProfileRead,
    dependencies=[Depends(limit_profile_requests)],
)
def create_farmer_profile(
    farmer_in: FarmerCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_farmer(current_user, farmer_in)
    except PROFILE_ERRORS as error:
        raise http_error(error) from None


@router.get(
    "/apartment/preview",
    response_model=ApartmentPreview,
    dependencies=[Depends(get_current_user), Depends(limit_profile_requests)],
)
def preview_apartment_profile(cnpj: Cnpj, profile_service: ProfileServiceDep):
    try:
        return profile_service.preview_apartment(cnpj)
    except PROFILE_ERRORS as error:
        raise http_error(error) from None


@router.post(
    "/apartment",
    status_code=status.HTTP_201_CREATED,
    response_model=ProfileRead,
    dependencies=[Depends(limit_profile_requests)],
)
def create_apartment_profile(
    apartment_in: ApartmentCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_apartment(current_user, apartment_in)
    except PROFILE_ERRORS as error:
        raise http_error(error) from None


@router.post(
    "/buyer",
    status_code=status.HTTP_201_CREATED,
    response_model=ProfileRead,
    dependencies=[Depends(limit_profile_requests)],
)
def create_buyer_profile(
    buyer_in: BuyerCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_buyer(current_user, buyer_in)
    except PROFILE_ERRORS as error:
        raise http_error(error) from None


@router.get("/me", response_model=ProfileRead)
def read_my_profile(current_user: CurrentUser, profile_service: ProfileServiceDep):
    return profile_service.get_profile(current_user)


@router.patch("/me", response_model=ProfileRead, dependencies=[Depends(limit_profile_requests)])
def update_my_profile(
    changes: ProfileUpdate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.update_profile(current_user, changes)
    except FieldNotInProfileError as error:
        message = f"O campo {error} não faz parte do seu perfil"
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message) from None
    except PROFILE_ERRORS as error:
        raise http_error(error) from None
