from datetime import datetime, timedelta
from decimal import Decimal

from sqlmodel import Session

from src.models.farmer import Farmer
from src.models.product import BUSINESS_TZ, Product
from tests.helpers import add_farmer, add_user


def add_product(
    session: Session,
    farmer: Farmer,
    name: str,
    description: str | None = None,
    *,
    quantity: int = 5,
    price: Decimal = Decimal("3.00"),
    days_until_expiration: int = 10,
) -> Product:
    product = Product(
        name=name,
        description=description,
        quantity=quantity,
        price=price,
        expiration_date=datetime.now(BUSINESS_TZ).date() + timedelta(days=days_until_expiration),
        farmer_id=farmer.id,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def add_farmer_with_name(session: Session, email: str) -> Farmer:
    return add_farmer(session, add_user(session, email))
