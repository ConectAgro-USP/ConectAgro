from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from src.api.deps import CurrentFarmer, ProductServiceDep
from src.models.product import ProductCreate, ProductDetailRead, ProductRead
from src.services.exceptions import ProductNotFoundError

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
