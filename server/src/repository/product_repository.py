from datetime import date
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.models.farmer import Farmer
from src.models.product import Product
from src.models.purchase import PurchaseProduct


class ProductInUseError(Exception):
    pass


class ProductRepository:
    def __init__(self, session: Session):
        self.session = session

    def save(self, product: Product) -> Product:
        self.session.add(product)
        self.session.commit()
        self.session.refresh(product)
        return product

    def list_products_by_farmer_id(self, farmer_id: int) -> list[Product]:
        statement = select(Product).where(Product.farmer_id == farmer_id)
        statement = statement.order_by(Product.created_at, Product.public_id)
        return list(self.session.exec(statement).all())

    def get_product_by_public_id(self, public_id: UUID) -> Product | None:
        statement = select(Product).where(Product.public_id == public_id)
        result = self.session.exec(statement).first()
        return result

    def catalog_products(self, today: date, limit: int = 10, offset: int = 0) -> list[Product]:
        statement = select(Product).where(Product.quantity > 0, Product.expiration_date >= today)
        statement = statement.order_by(Product.created_at, Product.public_id)
        statement = statement.offset(offset).limit(limit)
        statement = statement.options(selectinload(Product.farmer).selectinload(Farmer.user))
        
        return list(self.session.exec(statement).all())

    def has_purchases(self, product_id: int) -> bool:
        statement = select(PurchaseProduct.product_id).where(
            PurchaseProduct.product_id == product_id
        )
        return self.session.exec(statement.limit(1)).first() is not None

    def delete_product(self, product: Product) -> None:
        self.session.delete(product)
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise ProductInUseError from error
