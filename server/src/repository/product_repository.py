from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, delete, func, not_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from src.models.farmer import Farmer
from src.models.interest import Interest
from src.models.my_products import (
    EXPIRING_SOON_DAYS,
    MyProductCounts,
    MyProductsFilters,
    ProductAvailability,
)
from src.models.pagination import page_offset
from src.models.product import Product
from src.models.product_picture import ProductPicture
from src.models.product_search import (
    PRODUCTS_PER_PAGE,
    ProductSearchFilters,
    ProductSort,
)
from src.models.purchase import PurchaseProduct
from src.models.review import Review
from src.repository.pagination import fetch_page

# o produto vem com a nota média e o número de avaliações do agricultor
RatedProduct = tuple[Product, Decimal | float | None, int | None]


class ProductInUseError(Exception):
    pass


def on_sale(today: date):
    return and_(Product.expiration_date >= today, Product.quantity > 0, Product.is_available)


class ProductRepository:
    def __init__(self, session: Session):
        self.session = session

    def search(self, filters: ProductSearchFilters, today: date) -> tuple[list[RatedProduct], int]:
        conditions = [on_sale(today)]
        if filters.expiration_from is not None:
            conditions.append(Product.expiration_date >= filters.expiration_from)
        if filters.min_quantity is not None:
            conditions.append(Product.quantity >= filters.min_quantity)
        if filters.q is not None:
            conditions.append(
                or_(
                    Product.name_search.contains(filters.q, autoescape=True),
                    Product.description_search.contains(filters.q, autoescape=True),
                )
            )
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
        offset = page_offset(filters.page, PRODUCTS_PER_PAGE)
        rows = self.session.exec(statement.offset(offset).limit(PRODUCTS_PER_PAGE)).all()
        total = self.session.exec(select(func.count(Product.id)).where(*conditions)).one()
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
            # acerto no nome vem antes do acerto só na descrição
            return statement.order_by(
                Product.name_search.startswith(query, autoescape=True).desc(),  # NOSONAR
                Product.name_search.contains(query, autoescape=True).desc(),
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

    def list_products_by_farmer_id(
        self, farmer_id: int, filters: MyProductsFilters, today: date
    ) -> tuple[list[Product], int]:
        statement = select(Product).where(Product.farmer_id == farmer_id)
        if filters.availability == ProductAvailability.AVAILABLE:
            statement = statement.where(on_sale(today))
        elif filters.availability == ProductAvailability.HIDDEN:
            statement = statement.where(not_(on_sale(today)))
        statement = statement.order_by(Product.created_at, Product.public_id)
        return fetch_page(self.session, statement, filters)

    def count_products_of_farmer(self, farmer_id: int, today: date) -> MyProductCounts:
        listed = and_(Product.is_available, Product.expiration_date >= today)
        soon = today + timedelta(days=EXPIRING_SOON_DAYS)
        statement = select(
            func.count(Product.id),
            func.count(Product.id).filter(on_sale(today)),
            func.count(Product.id).filter(listed, Product.quantity == 0),
            func.count(Product.id).filter(on_sale(today), Product.expiration_date <= soon),
        ).where(Product.farmer_id == farmer_id)
        everything, available, sold_out, expiring_soon = self.session.exec(statement).one()
        return MyProductCounts(
            all=everything,
            available=available,
            hidden=everything - available,
            sold_out=sold_out,
            expiring_soon=expiring_soon,
        )

    def get_product_by_public_id(self, public_id: UUID) -> Product | None:
        statement = select(Product).where(Product.public_id == public_id)
        result = self.session.exec(statement).first()
        return result

    def lock_product(self, product_id: int) -> None:
        statement = select(Product.id).where(Product.id == product_id)
        self.session.exec(statement.with_for_update()).first()

    def has_purchases(self, product_id: int) -> bool:
        statement = select(PurchaseProduct.product_id).where(
            PurchaseProduct.product_id == product_id
        )
        return self.session.exec(statement.limit(1)).first() is not None

    def locked_units(self, product_ids: list[int]) -> set[int]:
        # a unidade muda o sentido das quantidades já pedidas ou vendidas
        if not product_ids:
            return set()
        sold = select(PurchaseProduct.product_id).where(PurchaseProduct.product_id == Product.id)
        wanted = select(Interest.id).where(Interest.product_id == Product.id)
        statement = select(Product.id).where(
            col(Product.id).in_(product_ids), or_(sold.exists(), wanted.exists())
        )
        return set(self.session.exec(statement).all())

    def is_unit_locked(self, product_id: int) -> bool:
        return product_id in self.locked_units([product_id])

    def delete_product(self, product: Product) -> None:
        # a foto sai junto, o SQLite dos testes não aplica o cascade da chave
        self.session.exec(delete(ProductPicture).where(ProductPicture.product_id == product.id))
        self.session.delete(product)
        try:
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise ProductInUseError from error
