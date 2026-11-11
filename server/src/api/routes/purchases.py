from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from src.api.deps import CurrentApartment, CurrentFarmer, CurrentUser, PurchaseServiceDep
from src.models.purchase import (
    PurchaseCreate,
    PurchasePartRead,
    PurchasePartStatusUpdate,
    PurchaseRead,
)
from src.services.exceptions import (
    ProductExpiredError,
    ProductNotFoundError,
    ProductOutOfStockError,
    PurchaseAccessDeniedError,
    PurchaseAlreadyDeliveredError,
    PurchaseNotFoundError,
    PurchasePartClosedError,
)

router = APIRouter(prefix="/purchases", tags=["purchases"])

PURCHASE_NOT_FOUND = "Compra não encontrada"
PURCHASE_ACCESS_DENIED = "Você não tem acesso a esta compra"


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PurchaseRead)
def create_purchase(
    purchase_in: PurchaseCreate, apartment: CurrentApartment, purchase_service: PurchaseServiceDep
):
    try:
        return purchase_service.create(apartment, purchase_in)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado") from None
    except ProductExpiredError as error:
        message = f"O produto {error} está vencido e não pode ser comprado"
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None
    except ProductOutOfStockError as error:
        message = f"O produto {error} não tem a quantidade pedida"
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None


@router.get("/{public_id}", response_model=PurchaseRead)
def get_purchase(public_id: UUID, current_user: CurrentUser, purchase_service: PurchaseServiceDep):
    try:
        return purchase_service.get_purchase(public_id, current_user)
    except PurchaseNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PURCHASE_NOT_FOUND) from None
    except PurchaseAccessDeniedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, PURCHASE_ACCESS_DENIED) from None


@router.patch("/{public_id}/parts/me/status", response_model=PurchasePartRead)
def change_my_part_status(
    public_id: UUID,
    status_update: PurchasePartStatusUpdate,
    farmer: CurrentFarmer,
    purchase_service: PurchaseServiceDep,
):
    try:
        return purchase_service.change_own_part_status(public_id, farmer, status_update.status)
    except PurchaseNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PURCHASE_NOT_FOUND) from None
    except PurchaseAccessDeniedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, PURCHASE_ACCESS_DENIED) from None
    except PurchasePartClosedError:
        message = "Esta parte da compra já foi encerrada"
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None


@router.post("/{public_id}/cancel", response_model=PurchaseRead)
def cancel_purchase(
    public_id: UUID, apartment: CurrentApartment, purchase_service: PurchaseServiceDep
):
    try:
        return purchase_service.cancel(public_id, apartment)
    except PurchaseNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PURCHASE_NOT_FOUND) from None
    except PurchaseAccessDeniedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, PURCHASE_ACCESS_DENIED) from None
    except PurchaseAlreadyDeliveredError:
        message = "A compra não pode ser cancelada depois que uma parte foi entregue"
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None
