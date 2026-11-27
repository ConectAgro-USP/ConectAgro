from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.product import Product
from tests.helpers import add_interest, add_purchase, add_resident, add_user


def wanted(session: Session, building: Apartment, product: Product) -> None:
    resident = add_resident(session, building, add_user(session, "bia@example.com"))
    add_interest(session, resident, product, quantity=3)


def sold(session: Session, building: Apartment, product: Product) -> None:
    add_purchase(session, building, (product, 5))
