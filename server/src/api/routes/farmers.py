from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import (
    CurrentBuilding,
    CurrentFarmer,
    FarmerSearchServiceDep,
    PurchaseServiceDep,
)
from src.models.farmer_search import FarmerSearchFilters, FarmerSearchResponse
from src.models.purchase_history import SalesFilters, SalesHistory
from src.services.exceptions import BuildingWithoutCoordinatesError, ExternalServiceError

router = APIRouter(prefix="/farmers", tags=["farmers"])


@router.get("")
def search_farmers(
    filters: Annotated[FarmerSearchFilters, Query()],
    building: CurrentBuilding,
    search_service: FarmerSearchServiceDep,
) -> FarmerSearchResponse:
    # Executa a busca e retorna os agricultores filtrados e ordenados
    try:
        return search_service.search(filters, building)
    except BuildingWithoutCoordinatesError:
        message = (
            "Não foi possível localizar o CEP do prédio para calcular as distâncias. "
            "O síndico deve revisar o CEP em Meu perfil"
        )
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None
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
