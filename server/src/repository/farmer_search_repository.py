from sqlalchemy.orm import joinedload
from sqlmodel import Session, col, func, select

from src.models.farmer import Farmer
from src.models.product import Product
from src.models.purchase import Purchase, PurchaseStatus
from src.models.review import Review
from src.models.user import User


class FarmerSearchRepository:
    def __init__(self, session: Session):
        self.session = session


    def search(
        self,
        name: str | None = None,
        products: list[str] | None = None
    ) -> list[Farmer]:
        
        query = select(Farmer).join(User).options(joinedload(Farmer.user))

        name = name.strip() if name else None

        if name:
            query = query.where(col(User.name).ilike(f"%{name}%"))

        products = [product.strip() for product in products or [] if product.strip()]

        for product in products or []:
            farmer = select(Product.farmer_id).where(col(Product.name).ilike(f"%{product}%"))
            query = query.where((Farmer.id).in_(farmer))

        farmers = list(self.session.exec(query).all())

        return farmers


    def get_review_summaries_by_id(self, farmer_ids: list[int]) -> dict[int, tuple[float, int]]:
        if not farmer_ids:
            return {}

        query = (
            select(Review.farmer_id, func.avg(Review.rating),func.count(Review.id))
            .where(col(Review.farmer_id).in_(farmer_ids))
            .group_by(Review.farmer_id)
        )

        reviews_summaries = {
            farmer_id: (round(float(average), 2), int(count)) 
            for farmer_id, average, count in self.session.exec(query).all()
        }

        return reviews_summaries

    def get_delivery_counts_by_id(self, farmer_ids: list[int]) -> dict[int, tuple[int, int]]:
        if not farmer_ids:
            return {}

        on_time = func.date(Purchase.closed_at) <= Purchase.expected_delivery_date
        
        query = (
            select(
                Purchase.farmer_id,
                func.count(Purchase.id),
                func.count(Purchase.id).filter(on_time),
            )
            .where(
                col(Purchase.farmer_id).in_(farmer_ids),
                col(Purchase.status) == PurchaseStatus.ENTREGUE,
            )
            .group_by(Purchase.farmer_id)
        )

        delivery_count = {
                farmer_id: (int(on_time_count), int(delivered_count))
                for farmer_id, delivered_count, on_time_count in self.session.exec(query).all()
        }
        
        return delivery_count

    def get_products_by_farmer_id(self, farmer_ids: list[int]) -> dict[int, list[str]]:
        if not farmer_ids:
            return {}

        query = select(Product.farmer_id, Product.name).where(
            col(Product.farmer_id).in_(farmer_ids)
        )

        products: dict[int, list[str]] = {farmer_id: [] for farmer_id in farmer_ids}
        
        for farmer_id, name in self.session.exec(query).all():
            products[farmer_id].append(name)
        
        return products
