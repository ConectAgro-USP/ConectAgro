from datetime import datetime
from uuid import UUID

from src.models.farmer import Farmer
from src.models.product import (
    BUSINESS_TZ,
    Product,
    ProductCatalogRead,
    ProductCreate,
    ProductDetailRead,
    ProductFarmerRead,
    ProductUpdate,
)
from src.repository.product_repository import ProductRepository
from src.services.exceptions import NotProductOwnerError, ProductNotFoundError
from src.services.text_service import short_name


class ProductService:
    def __init__(self, products: ProductRepository):
        self.products = products

    def create(self, farmer: Farmer, product_in: ProductCreate) -> Product:
        # o dono vem do perfil logado, e não do corpo, para ninguém cadastrar em nome de outro
        product = Product.model_validate(product_in, update={"farmer_id": farmer.id})
        return self.products.save(product)

    def get_current_farmer_products(self, farmer: Farmer) -> list[Product]:
        return self.products.list_products_by_farmer_id(farmer.id)

    def get_product_by_public_id(self, public_id: UUID) -> ProductDetailRead:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        return ProductDetailRead.model_validate(
            product, update={"farmer": _farmer_summary(product.farmer)}
        )

    def catalog_products(self, limit: int = 10, offset: int = 0) -> list[ProductCatalogRead]:
        today = datetime.now(BUSINESS_TZ).date()
        
        products = self.products.catalog_products(today, limit, offset)
        catalog_products = []
        for product in products:
            catalog_products.append(ProductCatalogRead.model_validate(
                product, update={"farmer_short_name": short_name(product.farmer.user.name)}
            ))
        return catalog_products

    def update_product(self, public_id: UUID, farmer: Farmer, 
                       product_update: ProductUpdate) -> Product:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        if product.farmer_id != farmer.id:
            raise NotProductOwnerError 
        product.sqlmodel_update(product_update.model_dump(exclude_unset=True))
        return self.products.save(product)


def _farmer_summary(farmer: Farmer) -> ProductFarmerRead:
    return ProductFarmerRead(
        public_id=farmer.public_id,
        farm_name=farmer.farm_name,
        short_name=short_name(farmer.user.name),
        picture_url=farmer.user.picture_url,
        cellphone=farmer.user.cellphone,
        homephone=farmer.user.homephone,
    )

