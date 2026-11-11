from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import (
    BuildingZipCode,
    CurrentFarmer,
    FarmerSearchServiceDep,
    PurchaseServiceDep,
)
from src.models.farmer_search import FarmerSearchFilters, FarmerSearchResponse
from src.models.purchase_history import SalesFilters, SalesHistory
from src.services.exceptions import ExternalServiceError

router = APIRouter(prefix="/farmers", tags=["farmers"])


@router.get("")
def search_farmers(
    filters: Annotated[FarmerSearchFilters, Query()],
    building_zip_code: BuildingZipCode,
    search_service: FarmerSearchServiceDep,
) -> FarmerSearchResponse:
    # Executa a busca e retorna os agricultores filtrados e ordenados
    try:
        return search_service.search(filters, building_zip_code)
    except ExternalServiceError:
        message = "Não foi possível calcular as distâncias agora. Tente novamente mais tarde"
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, message) from None


@router.get("/me/sales", response_model=SalesHistory)
def list_my_sales(
    filters: Annotated[SalesFilters, Query()],
    farmer: CurrentFarmer,
    purchase_service: PurchaseServiceDep,
):
    return purchase_service.list_sales(farmer, filters)
