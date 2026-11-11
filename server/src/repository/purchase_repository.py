from uuid import UUID

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.models.product import Product
from src.models.purchase import Purchase, PurchasePart, PurchaseProduct


class PurchaseRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_public_id(self, public_id: UUID) -> Purchase | None:
        parts = selectinload(Purchase.purchase_parts)
        items = parts.selectinload(PurchasePart.purchase_products)
        statement = select(Purchase).where(Purchase.public_id == public_id)
        statement = statement.options(
            parts.selectinload(PurchasePart.farmer),
            items.selectinload(PurchaseProduct.product),
        )
        return self.session.exec(statement).first()

    def lock_by_public_id(self, public_id: UUID) -> Purchase | None:
        # trava antes de ler, para as partes virem atualizadas
        statement = select(Purchase.id).where(Purchase.public_id == public_id)
        if self.session.exec(statement.with_for_update()).first() is None:
            return None
        return self.get_by_public_id(public_id)

    def lock_products(self, public_ids: list[UUID]) -> list[Product]:
        # sempre na mesma ordem, para duas compras não se travarem
        statement = select(Product).where(Product.public_id.in_(public_ids))
        statement = statement.order_by(Product.id).with_for_update()
        # lê de novo o produto já carregado, para ter o estoque atual
        statement = statement.execution_options(populate_existing=True)
        return list(self.session.exec(statement).all())

    def add(self, purchase: Purchase) -> None:
        self.session.add(purchase)

    def commit(self) -> None:
        self.session.commit()
