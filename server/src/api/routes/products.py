from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import CurrentFarmer, ProductServiceDep
from src.models.product import (
    ProductCatalogRead,
    ProductCreate,
    ProductDetailRead,
    ProductRead,
    ProductUpdate,
)
from src.services.exceptions import (
    NotProductOwnerError,
    ProductHasPurchasesError,
    ProductNotFoundError,
)

router = APIRouter(prefix="/products", tags=["products"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProductRead)
def create_product(
    product_in: ProductCreate, farmer: CurrentFarmer, product_service: ProductServiceDep
):
    return product_service.create(farmer, product_in)


@router.get("/me", response_model=list[ProductRead])
def get_farmer_products(
    farmer: CurrentFarmer, product_service: ProductServiceDep
):
    return product_service.get_current_farmer_products(farmer)


@router.get("", response_model=list[ProductCatalogRead])
def catalog_products(
    product_service: ProductServiceDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return product_service.catalog_products(limit, offset)


@router.patch("/{public_id}", response_model=ProductRead)
def patch_product(public_id: UUID, farmer: CurrentFarmer, 
                  product_update: ProductUpdate, 
                  product_service: ProductServiceDep):
    try:
        return product_service.update_product(public_id, 
                                              farmer, product_update)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 
                            "Produto não encontrado") from None
    except NotProductOwnerError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, 
                            "Você só pode alterar seus produtos") from None

@router.get("/{public_id}", response_model=ProductDetailRead)
def get_product_by_public_id(
    public_id: UUID, product_service: ProductServiceDep
):
    # a rota não requer login, pois não há motivo para impedir um indivíduo
    # que não está logado de ver os dados públicos do produto e do agricultor
    try:
        return product_service.get_product_by_public_id(public_id)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado") from None

@router.delete("/{public_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    public_id: UUID, farmer: CurrentFarmer, product_service: ProductServiceDep
):
    try:
        product_service.delete_product(public_id, farmer)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado") from None
    except NotProductOwnerError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, 
                            "Você só pode deletar seus produtos") from None
    except ProductHasPurchasesError:
        message = (
            "Este produto já foi vendido e não pode ser removido. "
            "Zere a quantidade para tirá-lo do catálogo"
        )
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None

