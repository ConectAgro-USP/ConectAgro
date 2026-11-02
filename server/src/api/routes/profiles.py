from fastapi import APIRouter, HTTPException, status

from src.api.deps import CurrentUser, ProfileServiceDep
from src.models.profile import (
    ApartmentCreate,
    BuyerCreate,
    FarmerCreate,
    ProfileRead,
    ProfileUpdate,
)
from src.services.exceptions import (
    ApartmentNotFoundError,
    CepNotFoundError,
    CepWithoutCoordinatesError,
    CnpjAlreadyRegisteredError,
    CnpjNotActiveError,
    CnpjNotFoundError,
    ExternalServiceError,
    FieldNotInProfileError,
    InvalidCepError,
    InvalidCnpjError,
    ProfileAlreadyExistsError,
    RateLimitedError,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])

CONFLICT = status.HTTP_409_CONFLICT
UNPROCESSABLE = status.HTTP_422_UNPROCESSABLE_CONTENT
UNAVAILABLE = status.HTTP_503_SERVICE_UNAVAILABLE

HTTP_ERRORS = {
    ProfileAlreadyExistsError: (CONFLICT, "Você já tem um perfil"),
    CnpjAlreadyRegisteredError: (CONFLICT, "Este CNPJ já está cadastrado"),
    ApartmentNotFoundError: (UNPROCESSABLE, "Prédio não encontrado"),
    InvalidCepError: (UNPROCESSABLE, "CEP inválido"),
    CepNotFoundError: (UNPROCESSABLE, "CEP não encontrado"),
    CepWithoutCoordinatesError: (
        UNPROCESSABLE,
        "Não foi possível localizar este CEP. Informe um CEP próximo",
    ),
    # só vem da BrasilAPI: a CNPJá fora do ar não barra o CNPJ
    ExternalServiceError: (
        UNAVAILABLE,
        "Não foi possível consultar o CEP agora. Tente novamente mais tarde",
    ),
    InvalidCnpjError: (UNPROCESSABLE, "CNPJ inválido"),
    CnpjNotFoundError: (UNPROCESSABLE, "CNPJ não encontrado"),
    CnpjNotActiveError: (UNPROCESSABLE, "CNPJ não está ativo"),
    RateLimitedError: (
        UNAVAILABLE,
        "Não foi possível consultar o CNPJ agora. Tente novamente mais tarde",
    ),
}
PROFILE_ERRORS = tuple(HTTP_ERRORS)


def http_error(error: Exception) -> HTTPException:
    status_code, message = HTTP_ERRORS[type(error)]
    return HTTPException(status_code, message)


# def e não async, para o FastAPI rodar o banco e as APIs externas no threadpool
@router.post("/farmer", status_code=status.HTTP_201_CREATED, response_model=ProfileRead)
def create_farmer_profile(
    farmer_in: FarmerCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_farmer(current_user, farmer_in)
    except PROFILE_ERRORS as error:
        raise http_error(error) from None


@router.post("/apartment", status_code=status.HTTP_201_CREATED, response_model=ProfileRead)
def create_apartment_profile(
    apartment_in: ApartmentCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_apartment(current_user, apartment_in)
    except PROFILE_ERRORS as error:
        raise http_error(error) from None


@router.post("/buyer", status_code=status.HTTP_201_CREATED, response_model=ProfileRead)
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


@router.patch("/me", response_model=ProfileRead)
def update_my_profile(
    changes: ProfileUpdate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.update_profile(current_user, changes)
    except FieldNotInProfileError as error:
        message = f"O campo {error} não faz parte do seu perfil"
        raise HTTPException(UNPROCESSABLE, message) from None
    except PROFILE_ERRORS as error:
        raise http_error(error) from None
