from uuid import UUID

from sqlmodel import Session, select

from src.models.product import Product
from src.models.product_picture import ProductPicture


class ProductPictureRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_product_id(self, product_id: int) -> ProductPicture | None:
        statement = select(ProductPicture).where(ProductPicture.product_id == product_id)
        return self.session.exec(statement).first()

    def get_with_product(self, public_id: UUID) -> tuple[ProductPicture, Product] | None:
        statement = (
            select(ProductPicture, Product)
            .join(Product, Product.id == ProductPicture.product_id)
            .where(Product.public_id == public_id)
        )
        row = self.session.exec(statement).first()
        return None if row is None else (row[0], row[1])

    def save(self, picture: ProductPicture, product: Product) -> Product:
        self.session.add(picture)
        self.session.add(product)
        self.session.commit()
        self.session.refresh(product)
        return product
