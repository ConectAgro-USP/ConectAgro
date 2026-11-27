from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status

from src.api.deps import (
    CurrentBuilding,
    CurrentFarmer,
    CurrentUser,
    ProductPictureServiceDep,
    ProductSearchServiceDep,
    ProductServiceDep,
)
from src.api.rate_limits import limit_picture_uploads
from src.models.my_products import MyProductsFilters, MyProductsPage
from src.models.product import (
    ProductContactRead,
    ProductCreate,
    ProductDetailRead,
    ProductRead,
    ProductUpdate,
)
from src.models.product_search import ProductSearchFilters, ProductSearchResponse
from src.services.exceptions import (
    NotProductOwnerError,
    PictureTooLargeError,
    ProductHasPurchasesError,
    ProductNotFoundError,
    ProductPictureNotFoundError,
    ProductUnitLockedError,
    UnsupportedPictureTypeError,
)
from src.services.product_picture_service import MAX_PICTURE_BYTES

router = APIRouter(prefix="/products", tags=["products"])

PRODUCT_NOT_FOUND = "Produto não encontrado"
PICTURE_TOO_LARGE = "A foto deve ter no máximo 1 MB"
# a foto é pública como o catálogo, e a URL muda quando ela muda
PICTURE_CACHE_CONTROL = "public, max-age=86400"


async def read_picture_body(request: Request) -> bytes:
    # recusa pelo tamanho declarado, e para de ler logo depois do limite
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_PICTURE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, PICTURE_TOO_LARGE)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_PICTURE_BYTES:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, PICTURE_TOO_LARGE)
    return bytes(body)


PictureBody = Annotated[bytes, Depends(read_picture_body)]


def etag_matches(if_none_match: str, etag: str) -> bool:
    tags = (tag.strip().removeprefix("W/") for tag in if_none_match.split(","))
    return any(tag in ("*", etag) for tag in tags)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProductRead)
def create_product(
    product_in: ProductCreate, farmer: CurrentFarmer, product_service: ProductServiceDep
):
    return product_service.create(farmer, product_in)


@router.get("/me", response_model=MyProductsPage)
def get_farmer_products(
    filters: Annotated[MyProductsFilters, Query()],
    farmer: CurrentFarmer,
    product_service: ProductServiceDep,
):
    return product_service.get_current_farmer_products(farmer, filters)


@router.get("", response_model=ProductSearchResponse)
def search_products(
    filters: Annotated[ProductSearchFilters, Query()],
    product_search: ProductSearchServiceDep,
):
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
    except ProductUnitLockedError:
        message = "A unidade não pode mudar depois que o produto recebeu interesse ou foi vendido"
        raise HTTPException(status.HTTP_409_CONFLICT, message) from None


@router.get("/{public_id}", response_model=ProductDetailRead)
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


@router.get("/{public_id}/contact", response_model=ProductContactRead)
def get_product_contact(
    public_id: UUID,
    current_user: CurrentUser,
    building: CurrentBuilding,
    product_service: ProductServiceDep,
):
    try:
        return product_service.get_product_contact(public_id, current_user, building)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PRODUCT_NOT_FOUND) from None


@router.post(
    "/{public_id}/picture",
    response_model=ProductRead,
    dependencies=[Depends(limit_picture_uploads)],
)
def upload_product_picture(
    public_id: UUID,
    farmer: CurrentFarmer,
    data: PictureBody,
    picture_service: ProductPictureServiceDep,
    content_type: Annotated[str | None, Header()] = None,
):
    media_type = (content_type or "").split(";")[0].strip().lower()
    try:
        return picture_service.save_picture(public_id, farmer, data, media_type)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, PRODUCT_NOT_FOUND) from None
    except NotProductOwnerError:
        message = "Você só pode alterar seus produtos"
        raise HTTPException(status.HTTP_403_FORBIDDEN, message) from None
    except PictureTooLargeError:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, PICTURE_TOO_LARGE) from None
    except UnsupportedPictureTypeError:
        message = "Envie uma foto em JPEG, PNG ou WebP"
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, message) from None


@router.get("/{public_id}/picture", response_class=Response)
def get_product_picture(
    public_id: UUID,
    picture_service: ProductPictureServiceDep,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    try:
        picture = picture_service.get_picture(public_id)
    except ProductPictureNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foto não encontrada") from None
    etag = f'"{picture.etag}"'
    headers = {
        "ETag": etag,
        "Cache-Control": PICTURE_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
    }
    if if_none_match is not None and etag_matches(if_none_match, etag):
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(picture.data, media_type=picture.content_type, headers=headers)
