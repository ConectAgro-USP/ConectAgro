from enum import IntEnum

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import CurrentUser, DistanceServiceDep, SessionDep
from src.models.farmer import FarmerSearchResponse
from src.repository.profile_repository import ProfileRepository
from src.services.farmer_search_service import FarmerSearchService


class AllowedDistances(IntEnum):
    FIVE = 5
    TEN = 10
    FIFTEEN = 15


router = APIRouter()


@router.get("/farmers", response_model=list[FarmerSearchResponse])
def list_nearby_farmers(
    current_user: CurrentUser,
    session: SessionDep,
    distance_service: DistanceServiceDep,
    max_distance_km: AllowedDistances = Query(...) # noqa: B008
):
    # Obtem o CEP
    building_zip_code = None
    if current_user.apartment:
        building_zip_code = current_user.apartment.zip_code
    elif current_user.buyer and current_user.buyer.apartment:
        building_zip_code = current_user.buyer.apartment.zip_code

    if not building_zip_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário não possui um prédio associado com CEP válido.",
        )

    # Instancia o repositorio e o serviço de busca
    profile_repository = ProfileRepository(session)
    search_service = FarmerSearchService(
        profile_repository=profile_repository,
        distance_service=distance_service,
    )

    # Executa a busca e retorna os agricultores filtrados e ordenados
    return search_service.search_nearby_farmers(
        building_cep=building_zip_code,
        max_distance_km=float(max_distance_km.value),
    )