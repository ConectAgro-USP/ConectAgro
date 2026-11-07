from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.deps import (
    CurrentFarmer,
    ProductSearchServiceDep,
    ProductServiceDep,
    get_current_user,
)
from src.models.product import (
    ProductCreate,
    ProductDetailRead,
    ProductRead,
    ProductUpdate,
)
from src.models.product_search import ProductSearchFilters, ProductSearchPage
from src.services.exceptions import (
    NotProductOwnerError,
    ProductHasPurchasesError,
    ProductNotFoundError,
)

router = APIRouter(prefix="/products", tags=["products"])

PRODUCT_NOT_FOUND = "Produto não encontrado"


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProductRead)
def create_product(
    product_in: ProductCreate, farmer: CurrentFarmer, product_service: ProductServiceDep
):
    return product_service.create(farmer, product_in)


@router.get("/me", response_model=list[ProductRead])
def get_farmer_products(farmer: CurrentFarmer, product_service: ProductServiceDep):
    return product_service.get_current_farmer_products(farmer)


@router.get("", response_model=ProductSearchPage)
def search_products(
    filters: Annotated[ProductSearchFilters, Query()],
    product_search: ProductSearchServiceDep,
) -> ProductSearchPage:
    return product_search.search(filters)


@router.patch("/{public_id}", response_model=ProductRead)
def patch_product(
    public_id: UUID,
    farmer: CurrentFarmer,
    product_update: ProductUpdate,
    product_service: ProductServiceDep,
):
    try:
        return product_service.update_product(public_id, farmer, product_update)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PRODUCT_NOT_FOUND) from None
    except NotProductOwnerError:
        message = "Você só pode alterar seus produtos"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None


@router.get(
    "/{public_id}", response_model=ProductDetailRead, dependencies=[Depends(get_current_user)]
)
def get_product_by_public_id(public_id: UUID, product_service: ProductServiceDep):
    try:
        return product_service.get_product_by_public_id(public_id)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PRODUCT_NOT_FOUND) from None


@router.delete("/{public_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(public_id: UUID, farmer: CurrentFarmer, product_service: ProductServiceDep):
    try:
        product_service.delete_product(public_id, farmer)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PRODUCT_NOT_FOUND) from None
    except NotProductOwnerError:
        message = "Você só pode deletar seus produtos"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None
    except ProductHasPurchasesError:
        message = (
            "Este produto já foi vendido e não pode ser removido. "
            "Zere a quantidade para tirá-lo do catálogo"
        )
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None
