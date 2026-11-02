from datetime import UTC, datetime
from uuid import UUID

from src.connectors.brasilapi import BrasilApiConnector, normalize_cep
from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.profile import (
    ApartmentCreate,
    BuyerCreate,
    FarmerCreate,
    ProfileRead,
    ProfileType,
    ProfileUpdate,
)
from src.models.user import User
from src.repository.profile_repository import ProfileRepository
from src.services.cnpj_service import CnpjService, normalize_cnpj
from src.services.exceptions import (
    ApartmentNotFoundError,
    CepWithoutCoordinatesError,
    FieldNotInProfileError,
    ProfileAlreadyExistsError,
)

Profile = Farmer | Apartment | Buyer

USER_FIELDS = ["name", "cellphone", "homephone"]
PROFILE_FIELDS = {
    Farmer: ["zip_code"],
    Apartment: ["building_name", "zip_code", "building_cnpj"],
    Buyer: ["apartment_public_id", "block", "unit"],
}


class ProfileService:
    def __init__(self, profiles: ProfileRepository, ceps: BrasilApiConnector, cnpjs: CnpjService):
        self.profiles = profiles
        self.ceps = ceps
        self.cnpjs = cnpjs

    def get_profile(self, user: User) -> ProfileRead:
        profile = ProfileRead.model_validate(user)
        if user.farmer is not None:
            profile.profile_type = ProfileType.FARMER
        elif user.apartment is not None:
            profile.profile_type = ProfileType.APARTMENT
        elif user.buyer is not None:
            profile.profile_type = ProfileType.BUYER
        return profile

    def create_farmer(self, user: User, farmer_in: FarmerCreate) -> ProfileRead:
        self._check_user_has_no_profile(user)
        zip_code = self._check_zip_code(farmer_in.zip_code)

        farmer = Farmer(user_id=user.id, zip_code=zip_code)
        return self._save_new_profile(user, farmer)

    def create_apartment(self, user: User, apartment_in: ApartmentCreate) -> ProfileRead:
        self._check_user_has_no_profile(user)
        cnpj = normalize_cnpj(apartment_in.building_cnpj)
        zip_code = self._check_zip_code(apartment_in.zip_code)
        # a CNPJá fica por último porque aceita poucas consultas por minuto
        self.cnpjs.validate(cnpj)

        user.name = apartment_in.manager_name
        apartment = Apartment(
            manager_id=user.id,
            building_name=apartment_in.building_name,
            zip_code=zip_code,
            building_cnpj=cnpj,
        )
        return self._save_new_profile(user, apartment)

    def create_buyer(self, user: User, buyer_in: BuyerCreate) -> ProfileRead:
        self._check_user_has_no_profile(user)
        apartment = self._find_apartment(buyer_in.apartment_public_id)

        buyer = Buyer(
            user_id=user.id,
            apartment_id=apartment.id,
            block=buyer_in.block,
            unit=buyer_in.unit,
        )
        return self._save_new_profile(user, buyer)

    def update_profile(self, user: User, changes: ProfileUpdate) -> ProfileRead:
        new_values = changes.model_dump(exclude_unset=True)
        profile = user.farmer or user.apartment or user.buyer
        self._check_allowed_fields(new_values, profile)

        self._update_user(user, new_values)
        if isinstance(profile, Farmer):
            self._update_farmer(profile, new_values)
        if isinstance(profile, Apartment):
            self._update_apartment(profile, new_values)
        if isinstance(profile, Buyer):
            self._update_buyer(profile, new_values)

        self.profiles.commit()
        return self.get_profile(user)

    def _check_allowed_fields(self, new_values: dict, profile: Profile | None) -> None:
        allowed_fields = USER_FIELDS + PROFILE_FIELDS.get(type(profile), [])
        for field in new_values:
            if field not in allowed_fields:
                raise FieldNotInProfileError(field)

    def _update_user(self, user: User, new_values: dict) -> None:
        if "name" in new_values:
            user.name = new_values["name"]
        if "cellphone" in new_values:
            user.cellphone = new_values["cellphone"]
        if "homephone" in new_values:
            user.homephone = new_values["homephone"]

    def _update_farmer(self, farmer: Farmer, new_values: dict) -> None:
        if "zip_code" in new_values:
            zip_code = normalize_cep(new_values["zip_code"])
            if zip_code != farmer.zip_code:
                farmer.zip_code = self._check_zip_code(zip_code)

    def _update_apartment(self, apartment: Apartment, new_values: dict) -> None:
        new_cnpj = None
        if "building_cnpj" in new_values:
            cnpj = normalize_cnpj(new_values["building_cnpj"])
            if cnpj != apartment.building_cnpj:
                new_cnpj = cnpj

        if "building_name" in new_values:
            apartment.building_name = new_values["building_name"]

        if "zip_code" in new_values:
            zip_code = normalize_cep(new_values["zip_code"])
            if zip_code != apartment.zip_code:
                apartment.zip_code = self._check_zip_code(zip_code)

        if new_cnpj is not None:
            # a CNPJá fica por último porque aceita poucas consultas por minuto
            self.cnpjs.validate(new_cnpj)
            apartment.building_cnpj = new_cnpj

    def _update_buyer(self, buyer: Buyer, new_values: dict) -> None:
        sends_link = (
            "apartment_public_id" in new_values or "block" in new_values or "unit" in new_values
        )
        if not sends_link:
            return

        self.profiles.lock_and_reload(buyer)
        link_before = (buyer.apartment_id, buyer.block, buyer.unit)
        if "apartment_public_id" in new_values:
            buyer.apartment_id = self._find_apartment(new_values["apartment_public_id"]).id
        if "block" in new_values:
            buyer.block = new_values["block"]
        if "unit" in new_values:
            buyer.unit = new_values["unit"]
        link_changed = (buyer.apartment_id, buyer.block, buyer.unit) != link_before

        if link_changed or buyer.link_status == LinkStatus.RECUSADO:
            self._ask_for_approval_again(buyer)

    def _ask_for_approval_again(self, buyer: Buyer) -> None:
        buyer.link_status = LinkStatus.PENDENTE
        buyer.link_requested_at = datetime.now(UTC)
        buyer.link_reviewed_at = None

    def _check_user_has_no_profile(self, user: User) -> None:
        if user.farmer or user.apartment or user.buyer:
            raise ProfileAlreadyExistsError

    def _save_new_profile(self, user: User, profile: Profile) -> ProfileRead:
        self.profiles.lock_and_reload(user)
        self._check_user_has_no_profile(user)
        self.profiles.add(profile)
        self.profiles.commit()
        return self.get_profile(user)

    def _check_zip_code(self, zip_code: str) -> str:
        address = self.ceps.get_address(zip_code)
        if address.coordinates is None:
            raise CepWithoutCoordinatesError(address.cep)
        return address.cep

    def _find_apartment(self, public_id: UUID) -> Apartment:
        apartment = self.profiles.get_apartment_by_public_id(public_id)
        if apartment is None:
            raise ApartmentNotFoundError
        return apartment
