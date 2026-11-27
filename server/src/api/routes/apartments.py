from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.deps import (
    ApartmentServiceDep,
    CurrentApartment,
    InterestServiceDep,
    PurchaseServiceDep,
    get_current_user,
)
from src.models.interest import ApartmentNeedsFilters, ApartmentNeedsPage
from src.models.profile import (
    ApartmentMatch,
    BuildingNameQuery,
    Cnpj,
    ResidentRead,
    ResidentsFilters,
    ResidentsPage,
)
from src.models.purchase_history import BuildingPurchasesFilters, BuildingPurchasesHistory
from src.services.exceptions import (
    BuildingNameTooShortError,
    InvalidCnpjError,
    ResidentNotFoundError,
)

router = APIRouter(prefix="/apartments", tags=["apartments"])


@router.get("", response_model=list[ApartmentMatch], dependencies=[Depends(get_current_user)])
def list_apartments(
    apartment_service: ApartmentServiceDep,
    cnpj: Cnpj | None = None,
    name: BuildingNameQuery | None = None,
):
    if (cnpj is None) == (name is None):
        message = "Informe o CNPJ ou o nome do prédio, apenas um dos dois"
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)
    try:
        if name is not None:
            return apartment_service.list_by_name(name)
        return apartment_service.list_by_cnpj(cnpj)
    except InvalidCnpjError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "CNPJ inválido") from None
    except BuildingNameTooShortError:
        message = "Informe ao menos 3 letras do nome do prédio"
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message) from None


@router.get("/me/buyers", response_model=ResidentsPage)
def list_my_residents(
    filters: Annotated[ResidentsFilters, Query()],
    apartment: CurrentApartment,
    apartment_service: ApartmentServiceDep,
):
    return apartment_service.list_residents(apartment, filters)


@router.post("/me/buyers/{public_id}/approve", response_model=ResidentRead)
def approve_resident(
    public_id: UUID, apartment: CurrentApartment, apartment_service: ApartmentServiceDep
):
    try:
        return apartment_service.approve_resident(apartment, public_id)
    except ResidentNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Morador não encontrado") from None


@router.post("/me/buyers/{public_id}/reject", response_model=ResidentRead)
def reject_resident(
    public_id: UUID, apartment: CurrentApartment, apartment_service: ApartmentServiceDep
):
    try:
        return apartment_service.reject_resident(apartment, public_id)
    except ResidentNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Morador não encontrado") from None


@router.get("/me/purchases", response_model=BuildingPurchasesHistory)
def list_my_purchases(
    filters: Annotated[BuildingPurchasesFilters, Query()],
    apartment: CurrentApartment,
    purchase_service: PurchaseServiceDep,
):
    return purchase_service.list_building_purchases(apartment, filters)


@router.get("/me/needs", response_model=ApartmentNeedsPage)
def list_apartment_needs(
    filters: Annotated[ApartmentNeedsFilters, Query()],
    apartment: CurrentApartment,
    interest_service: InterestServiceDep,
):
    return interest_service.list_apartment_needs(apartment, filters)
