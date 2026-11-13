from uuid import UUID

from src.models.buyer import LinkStatus
from src.models.farmer import Farmer
from src.models.product import (
    Product,
    ProductContactRead,
    ProductCreate,
    ProductDetailRead,
    ProductFarmerRead,
    ProductUpdate,
)
from src.models.user import User
from src.repository.product_repository import ProductInUseError, ProductRepository
from src.services.exceptions import (
    NotProductOwnerError,
    ProductHasPurchasesError,
    ProductNotFoundError,
)
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

    def update_product(
        self, public_id: UUID, farmer: Farmer, product_update: ProductUpdate
    ) -> Product:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        if product.farmer_id != farmer.id:
            raise NotProductOwnerError
        product.sqlmodel_update(product_update.model_dump(exclude_unset=True))
        return self.products.save(product)

    def delete_product(self, public_id: UUID, farmer: Farmer) -> None:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        if farmer.id != product.farmer_id:
            raise NotProductOwnerError
        # a compra guarda o produto e o preço da época, e esse histórico não pode sumir
        if self.products.has_purchases(product.id):
            raise ProductHasPurchasesError
        try:
            self.products.delete_product(product)
        except ProductInUseError:
            # pode ser uma compra, gravada por outra pessoa depois da conferência acima
            if self.products.has_purchases(product.id):
                raise ProductHasPurchasesError from None
            raise

    def get_product_contact(self, public_id: UUID, current_user: User) -> ProductContactRead:
        if current_user.apartment is not None:
            product = self._get_existing_product(public_id)
            farmer_user = product.farmer.user
            return ProductContactRead(
                recipient_name=farmer_user.name,
                cellphone=farmer_user.cellphone or None,
                message=(
                    f"Olá, {farmer_user.name}! Tenho interesse no produto "
                    f"{product.name} do agricultor {farmer_user.name}."
                ),
            )

        buyer = current_user.buyer
        if (
            buyer is not None
            and buyer.link_status == LinkStatus.APROVADO
            and buyer.apartment is not None
        ):
            product = self._get_existing_product(public_id)
            manager = buyer.apartment.manager
            farmer_name = product.farmer.user.name
            return ProductContactRead(
                recipient_name=manager.name,
                cellphone=manager.cellphone or None,
                message=(
                    f"Olá, {manager.name}! Tenho interesse no produto "
                    f"{product.name} do agricultor {farmer_name}."
                ),
            )

        raise PermissionError

    def _get_existing_product(self, public_id: UUID) -> Product:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        return product

def _farmer_summary(farmer: Farmer) -> ProductFarmerRead:
    return ProductFarmerRead(
        public_id=farmer.public_id,
        farm_name=farmer.farm_name,
        short_name=short_name(farmer.user.name),
        picture_url=farmer.user.picture_url,
    )
