from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import FarmerSearchServiceDep
from src.schemas.farmer_search import FarmerSearchItem
from src.schemas.pagination import PaginatedResponse
from src.services.farmer_search_service import InvalidDistanceError, MissingOriginCepError

router = APIRouter(prefix="/farmers", tags=["farmers"])


@router.get("", response_model=PaginatedResponse[FarmerSearchItem])
def search_farmers(
    search_service: FarmerSearchServiceDep,
    name: str | None = None,
    products: Annotated[list[str] | None, Query()] = None,
    origin_cep: str | None = None,
    max_distance_km: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[FarmerSearchItem]:


    if max_distance_km is not None:
        if max_distance_km not in (5, 10, 15):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A distância máxima deve ser 5, 10 ou 15 km",
            )
        if not origin_cep or not origin_cep.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="O CEP de origem é obrigatório para filtrar por distância",
            )

    try:
        return search_service.search(
            name=name,
            products=products if products else None,
            origin_cep=origin_cep,
            max_distance_km=max_distance_km,
            page=page,
            page_size=page_size,
        )
    except (InvalidDistanceError, MissingOriginCepError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc