from enum import IntEnum
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import BuildingZipCode, FarmerSearchServiceDep
from src.models.farmer import FarmerSearchRead
from src.services.exceptions import ExternalServiceError

router = APIRouter(prefix="/farmers", tags=["farmers"])


class AllowedDistance(IntEnum):
    FIVE = 5
    TEN = 10
    FIFTEEN = 15


@router.get("", response_model=list[FarmerSearchRead])
def list_nearby_farmers(
    max_distance_km: Annotated[AllowedDistance, Query()],
    building_zip_code: BuildingZipCode,
    search_service: FarmerSearchServiceDep,
):
    # Executa a busca e retorna os agricultores filtrados e ordenados
    try:
        return search_service.search_nearby_farmers(building_zip_code, max_distance_km)
    except ExternalServiceError:
        message = "Não foi possível calcular as distâncias agora. Tente novamente mais tarde"
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, message) from None
