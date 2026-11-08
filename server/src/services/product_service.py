from src.models.farmer import Farmer
from src.models.product import Product, ProductCreate
from src.repository.product_repository import ProductRepository


class ProductService:
    def __init__(self, products: ProductRepository):
        self.products = products

    def create(self, farmer: Farmer, product_in: ProductCreate) -> Product:
        # o dono vem do perfil logado, e não do corpo, para ninguém cadastrar em nome de outro
        product = Product.model_validate(product_in, update={"farmer_id": farmer.id})
        return self.products.create(product)
