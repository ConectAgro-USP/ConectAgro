from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.deps import ApartmentServiceDep, CurrentApartment, get_current_user
from src.models.buyer import LinkStatus
from src.models.profile import ApartmentSummary, Cnpj, ResidentRead
from src.services.exceptions import InvalidCnpjError, ResidentNotFoundError

router = APIRouter(prefix="/apartments", tags=["apartments"])


@router.get("", response_model=list[ApartmentSummary], dependencies=[Depends(get_current_user)])
def list_apartments(cnpj: Cnpj, apartment_service: ApartmentServiceDep):
    try:
        return apartment_service.list_by_cnpj(cnpj)
    except InvalidCnpjError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "CNPJ inválido") from None


@router.get("/me/buyers", response_model=list[ResidentRead])
def list_my_residents(
    apartment: CurrentApartment,
    apartment_service: ApartmentServiceDep,
    link_status: Annotated[LinkStatus | None, Query(alias="status")] = None,
):
    return apartment_service.list_residents(apartment, link_status)


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
