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

PROFILE_EXISTS = "Você já tem um perfil"
CNPJ_TAKEN = "Este CNPJ já está cadastrado"
INVALID_CEP = "CEP inválido"
CEP_NOT_FOUND = "CEP não encontrado"
CEP_WITHOUT_LOCATION = "Não foi possível localizar este CEP. Informe um CEP próximo"
# ExternalServiceError só vem da BrasilAPI: a CNPJá fora do ar não barra o CNPJ
CEP_SERVICE_DOWN = "Não foi possível consultar o CEP agora. Tente novamente mais tarde"
INVALID_CNPJ = "CNPJ inválido"
CNPJ_NOT_FOUND = "CNPJ não encontrado"
CNPJ_NOT_ACTIVE = "CNPJ não está ativo"
CNPJ_SERVICE_DOWN = "Não foi possível consultar o CNPJ agora. Tente novamente mais tarde"
APARTMENT_NOT_FOUND = "Prédio não encontrado"


# def e não async, para o FastAPI rodar o banco e as APIs externas no threadpool
@router.post("/farmer", status_code=status.HTTP_201_CREATED, response_model=ProfileRead)
def create_farmer_profile(
    farmer_in: FarmerCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_farmer(current_user, farmer_in)
    except ProfileAlreadyExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, PROFILE_EXISTS) from None
    except InvalidCepError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_CEP) from None
    except CepNotFoundError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CEP_NOT_FOUND) from None
    except CepWithoutCoordinatesError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CEP_WITHOUT_LOCATION) from None
    except ExternalServiceError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, CEP_SERVICE_DOWN) from None


@router.post("/apartment", status_code=status.HTTP_201_CREATED, response_model=ProfileRead)
def create_apartment_profile(
    apartment_in: ApartmentCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_apartment(current_user, apartment_in)
    except ProfileAlreadyExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, PROFILE_EXISTS) from None
    except CnpjAlreadyRegisteredError:
        raise HTTPException(status.HTTP_409_CONFLICT, CNPJ_TAKEN) from None
    except InvalidCepError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_CEP) from None
    except CepNotFoundError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CEP_NOT_FOUND) from None
    except CepWithoutCoordinatesError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CEP_WITHOUT_LOCATION) from None
    except ExternalServiceError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, CEP_SERVICE_DOWN) from None
    except InvalidCnpjError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_CNPJ) from None
    except CnpjNotFoundError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CNPJ_NOT_FOUND) from None
    except CnpjNotActiveError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CNPJ_NOT_ACTIVE) from None
    except RateLimitedError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, CNPJ_SERVICE_DOWN) from None


@router.post("/buyer", status_code=status.HTTP_201_CREATED, response_model=ProfileRead)
def create_buyer_profile(
    buyer_in: BuyerCreate, current_user: CurrentUser, profile_service: ProfileServiceDep
):
    try:
        return profile_service.create_buyer(current_user, buyer_in)
    except ProfileAlreadyExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, PROFILE_EXISTS) from None
    except ApartmentNotFoundError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, APARTMENT_NOT_FOUND) from None


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
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message) from None
    except CnpjAlreadyRegisteredError:
        raise HTTPException(status.HTTP_409_CONFLICT, CNPJ_TAKEN) from None
    except ApartmentNotFoundError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, APARTMENT_NOT_FOUND) from None
    except InvalidCepError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_CEP) from None
    except CepNotFoundError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CEP_NOT_FOUND) from None
    except CepWithoutCoordinatesError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CEP_WITHOUT_LOCATION) from None
    except ExternalServiceError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, CEP_SERVICE_DOWN) from None
    except InvalidCnpjError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_CNPJ) from None
    except CnpjNotFoundError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CNPJ_NOT_FOUND) from None
    except CnpjNotActiveError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, CNPJ_NOT_ACTIVE) from None
    except RateLimitedError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, CNPJ_SERVICE_DOWN) from None
