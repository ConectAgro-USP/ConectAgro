from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import CurrentFarmer, CurrentReviewAuthor, ReviewServiceDep, get_current_user
from src.models.review import (
    FarmerReviewsRead,
    ReviewableRead,
    ReviewCreate,
    ReviewRead,
    ReviewUpdate,
)
from src.services.exceptions import (
    FarmerNotFoundError,
    NotReviewAuthorError,
    PurchaseAccessDeniedError,
    PurchaseNotFoundError,
    PurchasePartNotDeliveredError,
    ReviewAlreadyExistsError,
    ReviewNotFoundError,
)

router = APIRouter(tags=["reviews"])


@router.post(
    "/purchases/{public_id}/farmers/{farmer_public_id}/reviews",
    status_code=status.HTTP_201_CREATED,
    response_model=ReviewRead,
)
def create_review(
    public_id: UUID,
    farmer_public_id: UUID,
    review_in: ReviewCreate,
    author: CurrentReviewAuthor,
    review_service: ReviewServiceDep,
):
    try:
        return review_service.create(public_id, farmer_public_id, author, review_in)
    except PurchaseNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compra não encontrada") from None
    except PurchaseAccessDeniedError:
        message = "Você não tem acesso a esta compra"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None
    except FarmerNotFoundError:
        message = "O agricultor não faz parte desta compra"
        raise HTTPException(status.HTTP_404_NOT_FOUND, message) from None
    except PurchasePartNotDeliveredError:
        message = "O agricultor só pode ser avaliado depois da entrega"
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None
    except ReviewAlreadyExistsError:
        message = "Você já avaliou este agricultor nesta compra"
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None


@router.patch("/reviews/{public_id}", response_model=ReviewRead)
def update_review(
    public_id: UUID,
    review_update: ReviewUpdate,
    author: CurrentReviewAuthor,
    review_service: ReviewServiceDep,
):
    try:
        return review_service.update(public_id, author, review_update)
    except ReviewNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avaliação não encontrada") from None
    except NotReviewAuthorError:
        message = "Você só pode alterar suas avaliações"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None


@router.get("/purchases/reviewable", response_model=list[ReviewableRead])
def list_reviewable(author: CurrentReviewAuthor, review_service: ReviewServiceDep):
    return review_service.list_reviewable(author)


@router.get("/farmers/me/reviews", response_model=FarmerReviewsRead)
def list_my_reviews(farmer: CurrentFarmer, review_service: ReviewServiceDep):
    return review_service.list_by_farmer(farmer)


@router.get(
    "/farmers/{public_id}/reviews",
    response_model=FarmerReviewsRead,
    dependencies=[Depends(get_current_user)],
)
def list_farmer_reviews(public_id: UUID, review_service: ReviewServiceDep):
    try:
        return review_service.list_by_farmer_public_id(public_id)
    except FarmerNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agricultor não encontrado") from None
