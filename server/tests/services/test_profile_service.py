from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.profile import ProfileUpdate
from src.models.user import User
from src.repository.profile_repository import ProfileRepository
from src.services.profile_service import ProfileService
from tests.helpers import add_resident, login


def test_approval_made_meanwhile_does_not_follow_the_buyer_to_another_building(
    client: TestClient,
    session: Session,
    ana: User,
    manager: User,
    building: Apartment,
    other_building: Apartment,
):
    resident = add_resident(session, building, ana)
    login(client, manager)
    approval = client.post(f"/api/apartments/me/buyers/{resident.public_id}/approve")
    assert approval.json()["link_status"] == "APROVADO"
    assert ana.buyer.link_status == LinkStatus.PENDENTE
    profile_service = ProfileService(ProfileRepository(session), ceps=None, cnpjs=None)

    profile = profile_service.update_profile(
        ana, ProfileUpdate(apartment_public_id=other_building.public_id)
    )

    assert profile.buyer.apartment.public_id == other_building.public_id
    assert profile.buyer.link_status == LinkStatus.PENDENTE
