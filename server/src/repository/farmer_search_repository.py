from datetime import UTC, date, datetime

from sqlalchemy.orm import joinedload
from sqlmodel import Session, col, func, select

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from src.models.purchase import Purchase, PurchasePart, PurchaseStatus
from src.models.review import Review
from src.models.user import User


def business_date(moment: datetime) -> date:
    # o SQLite devolve a data sem fuso, e ela foi salva em UTC
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(BUSINESS_TZ).date()


class FarmerSearchRepository:
    def __init__(self, session: Session):
        self.session = session

    def search(self, name: str | None, products: list[str], today: date) -> list[Farmer]:
        query = select(Farmer).join(User).options(joinedload(Farmer.user)).order_by(Farmer.id)

        if name:
            query = query.where(col(User.name).icontains(name, autoescape=True))
            # o email salvo como nome fica de fora, para a busca não revelar o endereço
            query = query.where(col(User.name).not_like("%@%"))

        for product in products:
            sellers = select(Product.farmer_id).where(
                col(Product.name).icontains(product, autoescape=True),
                Product.quantity > 0,
                Product.expiration_date >= today,
            )
            query = query.where(col(Farmer.id).in_(sellers))

        return list(self.session.exec(query).all())

    def get_available_products_counts_by_id(
        self, farmer_ids: list[int], today: date
    ) -> dict[int, int]:
        if not farmer_ids:
            return {}

        query = (
            select(Product.farmer_id, func.count(Product.id))
            .where(
                col(Product.farmer_id).in_(farmer_ids),
                Product.quantity > 0,
                Product.expiration_date >= today,
            )
            .group_by(Product.farmer_id)
        )

        return dict(self.session.exec(query).all())

    def get_review_summaries_by_id(self, farmer_ids: list[int]) -> dict[int, tuple[float, int]]:
        if not farmer_ids:
            return {}

        query = (
            select(Review.farmer_id, func.avg(Review.rating), func.count(Review.id))
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

        query = (
            select(PurchasePart.farmer_id, PurchasePart.closed_at, Purchase.expected_delivery_date)
            .join(Purchase)
            .where(
                col(PurchasePart.farmer_id).in_(farmer_ids),
                col(PurchasePart.status) == PurchaseStatus.ENTREGUE,
            )
        )

        # a conta é feita aqui porque o dia do encerramento segue o fuso de Brasília
        delivery_count: dict[int, tuple[int, int]] = {}
        for farmer_id, closed_at, expected_date in self.session.exec(query).all():
            on_time_count, delivered_count = delivery_count.get(farmer_id, (0, 0))
            if closed_at is not None and business_date(closed_at) <= expected_date:
                on_time_count += 1
            delivery_count[farmer_id] = (on_time_count, delivered_count + 1)

        return delivery_count
