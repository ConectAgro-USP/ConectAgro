import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from src.models.buyer import Buyer
from src.models.interest import Interest
from src.repository.interest_repository import InterestRepository
from tests.helpers import add_farmer, add_interest, add_product, add_user, login


def test_update_of_an_interest_deleted_during_the_request_returns_404(
    client: TestClient, session: Session, resident: Buyer, monkeypatch: pytest.MonkeyPatch
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    interest = add_interest(session, resident, add_product(session, farmer))
    url = f"/api/interests/{interest.public_id}"
    read = InterestRepository.get_by_public_id

    def read_then_lose_the_row(self, public_id):
        found = read(self, public_id)
        # como a compra do síndico, que apaga o interesse depois da leitura
        session.exec(delete(Interest).where(Interest.public_id == public_id))
        session.commit()
        return found

    monkeypatch.setattr(InterestRepository, "get_by_public_id", read_then_lose_the_row)
    login(client, resident.user)

    response = client.patch(url, json={"quantity": 5})

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Interesse não encontrado"}
