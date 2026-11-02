from datetime import UTC, datetime
from uuid import UUID

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.repository.profile_repository import ProfileRepository
from src.services.exceptions import ResidentNotFoundError


class ApartmentService:
    def __init__(self, profiles: ProfileRepository):
        self.profiles = profiles

    def list_apartments(self) -> list[Apartment]:
        return self.profiles.list_apartments()

    def list_residents(self, apartment: Apartment, link_status: LinkStatus | None) -> list[Buyer]:
        return self.profiles.list_buyers_of_apartment(apartment.id, link_status)

    def approve_resident(self, apartment: Apartment, resident_public_id: UUID) -> Buyer:
        return self._review_resident(apartment, resident_public_id, LinkStatus.APROVADO)

    def reject_resident(self, apartment: Apartment, resident_public_id: UUID) -> Buyer:
        return self._review_resident(apartment, resident_public_id, LinkStatus.RECUSADO)

    def _review_resident(
        self, apartment: Apartment, resident_public_id: UUID, new_status: LinkStatus
    ) -> Buyer:
        resident = self.profiles.get_buyer_of_apartment(resident_public_id, apartment.id)
        if resident is None:
            raise ResidentNotFoundError

        resident.link_status = new_status
        resident.link_reviewed_at = datetime.now(UTC)
        self.profiles.commit()
        return resident
