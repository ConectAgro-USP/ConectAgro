from datetime import datetime
from uuid import UUID

from src.core.search_text import fold
from src.core.text import short_name
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.models.my_products import MyProductsFilters, MyProductsPage
from src.models.product import (
    BUSINESS_TZ,
    Product,
    ProductContactRead,
    ProductCreate,
    ProductDetailRead,
    ProductFarmerRead,
    ProductRead,
    ProductUpdate,
)
from src.models.user import User
from src.repository.product_repository import ProductInUseError, ProductRepository
from src.services.exceptions import (
    NotProductOwnerError,
    ProductHasPurchasesError,
    ProductNotFoundError,
)


class ProductService:
    def __init__(self, products: ProductRepository):
        self.products = products

    def create(self, farmer: Farmer, product_in: ProductCreate) -> Product:
        # o dono vem do perfil logado, e não do corpo, para ninguém cadastrar em nome de outro
        product = Product.model_validate(product_in, update={"farmer_id": farmer.id})
        fill_search_text(product)
        return self.products.save(product)

    def get_current_farmer_products(
        self, farmer: Farmer, filters: MyProductsFilters
    ) -> MyProductsPage:
        today = datetime.now(BUSINESS_TZ).date()
        products, total = self.products.list_products_by_farmer_id(farmer.id, filters, today)
        return MyProductsPage.from_params(
            [ProductRead.model_validate(product) for product in products],
            filters,
            total,
            counts=self.products.count_products_of_farmer(farmer.id, today),
        )

    def get_product_by_public_id(self, public_id: UUID) -> ProductDetailRead:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        return ProductDetailRead.model_validate(
            product, update={"farmer": farmer_summary(product.farmer)}
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
        fill_search_text(product)
        return self.products.save(product)

    def delete_product(self, public_id: UUID, farmer: Farmer) -> None:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        if farmer.id != product.farmer_id:
            raise NotProductOwnerError
        # trava o produto antes, como a compra, para as duas não se travarem
        self.products.lock_product(product.id)
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

    def get_product_contact(
        self, public_id: UUID, current_user: User, building: Apartment
    ) -> ProductContactRead:
        product = self._get_existing_product(public_id)
        if current_user.id == building.manager_id:
            recipient = product.farmer.user
            interest = f"Tenho interesse no seu produto {product.name}"
        else:
            recipient = building.manager
            farmer_name = short_name(product.farmer.user.name)
            by_farmer = f" do agricultor {farmer_name}" if farmer_name else ""
            interest = f"Tenho interesse no produto {product.name}{by_farmer}"
        recipient_name = short_name(recipient.name)
        greeting = f"Olá, {recipient_name}!" if recipient_name else "Olá!"
        return ProductContactRead(
            recipient_name=recipient_name,
            cellphone=recipient.cellphone or None,
            # o sobrenome abreviado (João S.) já traz o ponto final
            message=f"{greeting} {interest.removesuffix('.')}.",
        )

    def _get_existing_product(self, public_id: UUID) -> Product:
        product = self.products.get_product_by_public_id(public_id)
        if product is None:
            raise ProductNotFoundError
        return product


def fill_search_text(product: Product) -> None:
    product.name_search = fold(product.name)
    product.description_search = fold(product.description)


def farmer_summary(farmer: Farmer) -> ProductFarmerRead:
    return ProductFarmerRead(
        public_id=farmer.public_id,
        farm_name=farmer.farm_name,
        short_name=short_name(farmer.user.name),
        picture_url=farmer.user.picture_url,
    )
