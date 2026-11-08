from datetime import UTC, datetime
from uuid import UUID

from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.profile import ApartmentMatch
from src.repository.profile_repository import ProfileRepository
from src.services.cnpj_service import normalize_cnpj
from src.services.exceptions import ResidentNotFoundError
from src.services.text_service import short_name


class ApartmentService:
    def __init__(self, profiles: ProfileRepository):
        self.profiles = profiles

    def list_by_cnpj(self, cnpj: str) -> list[ApartmentMatch]:
        apartments = self.profiles.list_apartments_by_cnpj(normalize_cnpj(cnpj))
        apartment_matches = []
        for apartment in apartments:
            apartment_match = ApartmentMatch(
                public_id=apartment.public_id,
                building_name=apartment.building_name,
                building_cnpj=apartment.building_cnpj,
                zip_code=apartment.zip_code,
                address=apartment.address,
                manager_short_name=short_name(apartment.manager.name),
            )
            apartment_matches.append(apartment_match)
        return apartment_matches

    def list_residents(self, apartment: Apartment, link_status: LinkStatus | None) -> list[Buyer]:
        return self.profiles.list_buyers_of_apartment(apartment.id, link_status)

    def approve_resident(self, apartment: Apartment, resident_public_id: UUID) -> Buyer:
        return self._review_resident(apartment, resident_public_id, LinkStatus.APROVADO)

    def reject_resident(self, apartment: Apartment, resident_public_id: UUID) -> Buyer:
        return self._review_resident(apartment, resident_public_id, LinkStatus.RECUSADO)

    def _review_resident(
        self, apartment: Apartment, resident_public_id: UUID, new_status: LinkStatus
    ) -> Buyer:
        resident = self.profiles.lock_buyer_of_apartment(resident_public_id, apartment.id)
        if resident is None:
            raise ResidentNotFoundError

        resident.link_status = new_status
        resident.link_reviewed_at = datetime.now(UTC)
        self.profiles.commit()
        return resident
