from unittest.mock import create_autospec

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.connectors.brasilapi import BrasilApiConnector
from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.profile import FarmerCreate, ProfileUpdate
from src.models.user import User
from src.repository.profile_repository import DuplicateValueError, ProfileRepository
from src.services.profile_service import ProfileService
from tests.helpers import add_resident, login
from tests.services.test_distance_service import PRACA_DA_SE
from tests.test_profiles import FARMER


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


def test_integrity_error_that_is_not_about_the_cpf_is_not_hidden():
    profiles = create_autospec(ProfileRepository, instance=True)
    profiles.get_user_by_cpf.return_value = None
    profiles.commit.side_effect = DuplicateValueError
    ceps = create_autospec(BrasilApiConnector, instance=True)
    ceps.get_address.return_value = PRACA_DA_SE
    profile_service = ProfileService(profiles, ceps, cnpjs=None)
    ana = User(id=1, email="ana@example.com", name="Ana")

    with pytest.raises(DuplicateValueError):
        profile_service.create_farmer(ana, FarmerCreate(**FARMER))
