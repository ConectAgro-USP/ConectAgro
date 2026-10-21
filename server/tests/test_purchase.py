import pytest
from sqlmodel import Session, SQLModel, create_engine
from pydantic import ValidationError
from datetime import datetime, UTC

# Importa os teus models
from src.models.apartment import Apartment
from src.models.buyer import Buyer
from src.models.farmer import Farmer
from src.models.product import Product, Purchase, PurchaseProduct
from src.models.user import User, UserRead

sqlite_file_name = "sqlite:///:memory:"
engine = create_engine(sqlite_file_name, echo=False)

@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

def test_create_valid_purchase(session: Session):
    purchase = Purchase(
        apartment_id=1,
        farmer_id=2,
        status="EM PROGRESSO",
        expected_delivery_date=datetime(2026, 12, 1, tzinfo=UTC)
    )
    session.add(purchase)
    session.commit()
    session.refresh(purchase)
    
    assert purchase.id is not None
    assert purchase.status == "EM PROGRESSO"
    assert purchase.created_at is not None 

def test_purchase_status_validation():
    with pytest.raises(ValidationError):
        Purchase.model_validate({
            "apartment_id": 1,
            "farmer_id": 2,
            "status": "PENDENTE",
            "expected_delivery_date": datetime(2026, 12, 1, tzinfo=UTC)
        })

def test_purchase_product_validation():
    with pytest.raises(ValidationError):
        PurchaseProduct.model_validate({
            "purchase_id": 1,
            "product_id": 1,
            "quantity": 0, 
            "unit_price": 10.50
        })
        
    with pytest.raises(ValidationError):
        PurchaseProduct.model_validate({
            "purchase_id": 1,
            "product_id": 1,
            "quantity": 5,
            "unit_price": -5.00
        })

def test_purchase_products_relationship(session: Session):
    purchase = Purchase(
        apartment_id=1, 
        farmer_id=1, 
        expected_delivery_date=datetime(2026, 12, 1, tzinfo=UTC)
    )
    session.add(purchase)
    session.commit()
    
    pp1 = PurchaseProduct(purchase_id=purchase.id, product_id=10, quantity=2, unit_price=15.0)
    pp2 = PurchaseProduct(purchase_id=purchase.id, product_id=20, quantity=1, unit_price=30.0)
    
    session.add(pp1)
    session.add(pp2)
    session.commit()

    session.refresh(purchase)
    
    assert len(purchase.items) == 2
    assert purchase.items[0].unit_price == 15.0
    assert purchase.items[1].quantity == 1