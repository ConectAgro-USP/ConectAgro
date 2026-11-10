from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import BuildingZipCode, FarmerSearchServiceDep
from src.models.farmer_search import FarmerSearchFilters, FarmerSearchResponse
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
