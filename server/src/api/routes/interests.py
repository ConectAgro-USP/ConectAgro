from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status

from src.api.deps import CurrentBuyer, InterestServiceDep
from src.models.interest import (
    InterestCreate,
    InterestRead,
    InterestUpdate,
    MyInterestsFilters,
    MyInterestsPage,
)
from src.services.exceptions import (
    InterestAlreadyExistsError,
    InterestInPurchaseError,
    InterestNotFoundError,
    NotInterestOwnerDeleteError,
    NotInterestOwnerUpdateError,
    ProductNotFoundError,
    ProductUnavailableError,
    ProductUnitChangedError,
)

router = APIRouter(prefix="/interests", tags=["interests"])

HTTP_ERRORS = {
    ProductNotFoundError: (status.HTTP_404_NOT_FOUND, "Produto não encontrado"),
    ProductUnavailableError: (
        status.HTTP_409_CONFLICT,
        "Este produto não está mais disponível no catálogo",
    ),
    ProductUnitChangedError: (
        status.HTTP_409_CONFLICT,
        "A unidade do produto mudou. Confira a página antes de continuar",
    ),
    InterestNotFoundError: (status.HTTP_404_NOT_FOUND, "Interesse não encontrado"),
    InterestAlreadyExistsError: (
        status.HTTP_409_CONFLICT,
        "Interesse nesse produto já registrado",
    ),
    InterestInPurchaseError: (
        status.HTTP_409_CONFLICT,
        "Este interesse já está numa compra do prédio",
    ),
    NotInterestOwnerDeleteError: (
        status.HTTP_403_FORBIDDEN,
        "Você só pode excluir seus interesses",
    ),
    NotInterestOwnerUpdateError: (
        status.HTTP_403_FORBIDDEN,
        "Você só pode alterar seus interesses",
    ),
}

INTEREST_ERRORS = tuple(HTTP_ERRORS.keys())


def http_error(error: Exception) -> HTTPException:
    status_code, message = HTTP_ERRORS[type(error)]
    return HTTPException(status_code, message)


@router.post("", response_model=InterestRead, status_code=status.HTTP_201_CREATED)
def create_interest(
    interest_in: InterestCreate, buyer: CurrentBuyer, interest_service: InterestServiceDep
):
    try:
        return interest_service.create(buyer, interest_in)
    except INTEREST_ERRORS as error:
        raise http_error(error) from None


@router.get("/me", response_model=MyInterestsPage)
def get_interests(
    filters: Annotated[MyInterestsFilters, Query()],
    buyer: CurrentBuyer,
    interest_service: InterestServiceDep,
):
    return interest_service.list_interests(buyer, filters)


@router.patch("/{public_id}", response_model=InterestRead)
def update_interest(
    public_id: UUID,
    interest_update: InterestUpdate,
    buyer: CurrentBuyer,
    interest_service: InterestServiceDep,
):
    try:
        return interest_service.update(public_id, buyer, interest_update)
    except INTEREST_ERRORS as error:
        raise http_error(error) from None


@router.delete("/{public_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interest(public_id: UUID, buyer: CurrentBuyer, interest_service: InterestServiceDep):
    try:
        interest_service.delete(public_id, buyer)
    except INTEREST_ERRORS as error:
        raise http_error(error) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
