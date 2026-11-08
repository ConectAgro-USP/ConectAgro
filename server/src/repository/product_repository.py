from sqlmodel import Session, select

from src.models.product import Product


class ProductRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, product: Product) -> Product:
        self.session.add(product)
        self.session.commit()
        self.session.refresh(product)
        return product

    def list_products_by_farmer_id(self, farmer_id: int) -> list[Product]:
        statement = select(Product).where(Product.farmer_id == farmer_id)
        statement = statement.order_by(Product.created_at, Product.public_id)
        return list(self.session.exec(statement).all())
    