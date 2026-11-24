from datetime import UTC, datetime
from uuid import UUID

from src.core.search_text import fold
from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.profile import ApartmentMatch, ResidentRead, ResidentsFilters, ResidentsPage
from src.repository.profile_repository import ProfileRepository
from src.services.cnpj_service import normalize_cnpj
from src.services.exceptions import BuildingNameTooShortError, ResidentNotFoundError
from src.services.text_service import short_name

MIN_NAME_LETTERS = 3
MAX_NAME_MATCHES = 20


class ApartmentService:
    def __init__(self, profiles: ProfileRepository):
        self.profiles = profiles

    def list_by_cnpj(self, cnpj: str) -> list[ApartmentMatch]:
        apartments = self.profiles.list_apartments_by_cnpj(normalize_cnpj(cnpj))
        return [_match(apartment) for apartment in apartments]

    def list_by_name(self, name: str) -> list[ApartmentMatch]:
        folded_name = fold(name)
        if sum(char.isalnum() for char in folded_name) < MIN_NAME_LETTERS:
            raise BuildingNameTooShortError
        apartments = self.profiles.search_apartments_by_name(folded_name, MAX_NAME_MATCHES)
        return [_match(apartment) for apartment in apartments]

    def list_residents(self, apartment: Apartment, filters: ResidentsFilters) -> ResidentsPage:
        residents, total = self.profiles.list_buyers_of_apartment(apartment.id, filters)
        items = [ResidentRead.model_validate(resident) for resident in residents]
        return ResidentsPage.from_params(items, filters, total)

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


def _match(apartment: Apartment) -> ApartmentMatch:
    return ApartmentMatch(
        public_id=apartment.public_id,
        building_name=apartment.building_name,
        building_cnpj=apartment.building_cnpj,
        zip_code=apartment.zip_code,
        address=apartment.address,
        manager_short_name=short_name(apartment.manager.name),
    )
