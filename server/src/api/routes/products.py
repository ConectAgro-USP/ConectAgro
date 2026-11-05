from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.api.deps import ProductSearchServiceDep
from src.models.product_search import ProductSearchFilters, ProductSearchPage
from src.services.exceptions import ProductSearchNotImplementedError

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductSearchPage)
def search_products(
    filters: Annotated[ProductSearchFilters, Query()],
    product_search: ProductSearchServiceDep,
) -> ProductSearchPage:
    try:
        return product_search.search(filters)
    except ProductSearchNotImplementedError:
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED, "A busca de produtos ainda não foi implementada"
        ) from None
