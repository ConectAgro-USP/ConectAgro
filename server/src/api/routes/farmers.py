from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import FarmerSearchServiceDep
from src.models.farmer_search import FarmerSearchFilters, FarmerSearchResponse
from src.services.exceptions import InvalidDistanceError, MissingOriginCepError

router = APIRouter(prefix="/farmers", tags=["farmers"])


@router.get("")
def search_farmers(
    search_service: FarmerSearchServiceDep,
    filters: Annotated[FarmerSearchFilters, Query()]
) -> FarmerSearchResponse:


    if filters.max_distance_km is not None:
        if filters.max_distance_km not in (5, 10, 15):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A distância máxima deve ser 5, 10 ou 15 km",
            )
        if not filters.origin_cep or not filters.origin_cep.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="O CEP de origem é obrigatório para filtrar por distância",
            )

    try:
        filters = FarmerSearchFilters(
            name=filters.name,
            products=filters.products,
            origin_cep=filters.origin_cep,
            max_distance_km=filters.max_distance_km,
            page=filters.page,
            page_size=filters.page_size,
        )
        return search_service.search(filters)
    
    except (InvalidDistanceError, MissingOriginCepError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc