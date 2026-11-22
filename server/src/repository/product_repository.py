from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.models.farmer import Farmer
from src.models.product import Product
from src.models.product_search import (
    PRODUCTS_PER_PAGE,
    ProductSearchFilters,
    ProductSort,
)
from src.models.purchase import PurchaseProduct
from src.models.review import Review

# o produto vem com a nota média e o número de avaliações do agricultor
RatedProduct = tuple[Product, Decimal | float | None, int | None]


class ProductInUseError(Exception):
    pass


class ProductRepository:
    def __init__(self, session: Session):
        self.session = session


    def search(self, filters: ProductSearchFilters, today: date) -> tuple[list[RatedProduct], int]:
        conditions = [Product.expiration_date >= today, Product.quantity > 0, Product.is_available]
        if filters.expiration_from is not None:
            conditions.append(Product.expiration_date >= filters.expiration_from)
        if filters.min_quantity is not None:
            conditions.append(Product.quantity >= filters.min_quantity)
        if filters.q is not None:
            conditions.append(Product.name.icontains(filters.q, autoescape=True))
        if filters.farmer_public_id is not None:
            farmer_id = select(Farmer.id).where(Farmer.public_id == filters.farmer_public_id)
            conditions.append(Product.farmer_id == farmer_id.scalar_subquery())

        ratings = self._farmer_ratings()
        statement = (
            select(Product, ratings.c.average_rating, ratings.c.reviews_count)
            .outerjoin(ratings, ratings.c.farmer_id == Product.farmer_id)
            .where(*conditions)
            .options(selectinload(Product.farmer).selectinload(Farmer.user))
        )
        statement = self._order_statement(statement, filters.sort, filters.q, ratings)
        offset = (filters.page - 1) * PRODUCTS_PER_PAGE
        rows = self.session.exec(
            statement.offset(offset).limit(PRODUCTS_PER_PAGE)
        ).all()
        total = self.session.exec(
            select(func.count(Product.id)).where(*conditions)
        ).one()
        return list(rows), total


    @staticmethod
    def _farmer_ratings():
        return (
            select(
                Review.farmer_id.label("farmer_id"),
                func.avg(Review.rating).label("average_rating"),
                func.count(Review.id).label("reviews_count"),
            )
            .group_by(Review.farmer_id)
            .subquery()
        )


    @staticmethod
    def _order_statement(statement, sort: ProductSort, query: str | None, ratings):
        rating_order = ratings.c.average_rating.desc().nulls_last()
        if sort == ProductSort.LOWEST_PRICE:
            return statement.order_by(Product.price, Product.created_at, Product.public_id)
        if sort == ProductSort.LATEST_EXPIRATION:
            return statement.order_by(
                Product.expiration_date.desc(), Product.created_at, Product.public_id
            )
        if sort == ProductSort.HIGHEST_RATING:
            return statement.order_by(rating_order, Product.created_at, Product.public_id)
        if query is not None:
            return statement.order_by(
                Product.name.istartswith(query, autoescape=True).desc(),
                rating_order,
                Product.created_at,
                Product.public_id,
            )
        return statement.order_by(rating_order, Product.created_at, Product.public_id)


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
