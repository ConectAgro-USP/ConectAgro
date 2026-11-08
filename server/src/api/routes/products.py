from fastapi import APIRouter, status

from src.api.deps import CurrentFarmer, ProductServiceDep
from src.models.product import ProductCreate, ProductRead

router = APIRouter(prefix="/products", tags=["products"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProductRead)
def create_product(
    product_in: ProductCreate, farmer: CurrentFarmer, product_service: ProductServiceDep
):
    return product_service.create(farmer, product_in)
