from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import AfterValidator

from src.api.deps import ApartmentServiceDep, CurrentApartment, CurrentUser
from src.models.buyer import LinkStatus
from src.models.profile import ApartmentSummary, ResidentRead
from src.services.exceptions import ResidentNotFoundError
from src.services.text_service import reject_null_character

router = APIRouter(prefix="/apartments", tags=["apartments"])

RESIDENT_NOT_FOUND = "Morador não encontrado"

PageOffset = Annotated[int, Query(ge=0, le=10_000)]
PageSize = Annotated[int, Query(ge=1, le=100)]
SearchText = Annotated[
    str | None, Query(max_length=100), AfterValidator(reject_null_character)
]


# current_user não é usado, mas obriga a pessoa a estar logada
@router.get("", response_model=list[ApartmentSummary])
def list_apartments(
    current_user: CurrentUser,
    apartment_service: ApartmentServiceDep,
    name: SearchText = None,
    offset: PageOffset = 0,
    limit: PageSize = 50,
):
    return apartment_service.list_apartments(name, offset, limit)


@router.get("/me/buyers", response_model=list[ResidentRead])
def list_my_residents(
    apartment: CurrentApartment,
    apartment_service: ApartmentServiceDep,
    link_status: Annotated[LinkStatus | None, Query(alias="status")] = None,
    offset: PageOffset = 0,
    limit: PageSize = 50,
):
    return apartment_service.list_residents(apartment, link_status, offset, limit)


@router.post("/me/buyers/{public_id}/approve", response_model=ResidentRead)
def approve_resident(
    public_id: UUID, apartment: CurrentApartment, apartment_service: ApartmentServiceDep
):
    try:
        return apartment_service.approve_resident(apartment, public_id)
    except ResidentNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, RESIDENT_NOT_FOUND) from None


@router.post("/me/buyers/{public_id}/reject", response_model=ResidentRead)
def reject_resident(
    public_id: UUID, apartment: CurrentApartment, apartment_service: ApartmentServiceDep
):
    try:
        return apartment_service.reject_resident(apartment, public_id)
    except ResidentNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, RESIDENT_NOT_FOUND) from None
