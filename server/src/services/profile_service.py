from datetime import UTC, datetime
from uuid import UUID

from src.connectors.brasilapi import BrasilApiConnector, normalize_cep
from src.connectors.models import Company
from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.profile import (
    ApartmentCreate,
    ApartmentPreview,
    BuyerCreate,
    FarmerCreate,
    ProfileCreate,
    ProfileRead,
    ProfileType,
    ProfileUpdate,
)
from src.models.user import User
from src.repository.profile_repository import DuplicateValueError, ProfileRepository
from src.services.cnpj_service import CnpjService, normalize_cnpj
from src.services.exceptions import (
    ApartmentNotFoundError,
    CepWithoutCoordinatesError,
    CpfAlreadyRegisteredError,
    FieldNotInProfileError,
    ProfileAlreadyExistsError,
)

Profile = Farmer | Apartment | Buyer

USER_FIELDS = ["name", "cellphone", "homephone"]
PROFILE_FIELDS = {
    Farmer: ["farm_name", "zip_code"],
    Apartment: ["zip_code", "building_cnpj"],
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

    def preview_apartment(self, building_cnpj: str) -> ApartmentPreview:
        company = self.cnpjs.get_active_company(building_cnpj)
        return ApartmentPreview(
            building_name=_building_name(company),
            zip_code=company.cep,
            address=company.address,
        )

    def create_farmer(self, user: User, farmer_in: FarmerCreate) -> ProfileRead:
        self._check_user_has_no_profile(user)
        self._check_cpf_is_new(farmer_in.cpf)
        zip_code = self._check_zip_code(farmer_in.zip_code)

        farmer = Farmer(user_id=user.id, farm_name=farmer_in.farm_name, zip_code=zip_code)
        return self._save_new_profile(user, farmer_in, farmer)

    def create_apartment(self, user: User, apartment_in: ApartmentCreate) -> ProfileRead:
        self._check_user_has_no_profile(user)
        self._check_cpf_is_new(apartment_in.cpf)
        cnpj = normalize_cnpj(apartment_in.building_cnpj)
        zip_code = self._check_zip_code(apartment_in.zip_code)
        # a CNPJá fica por último porque aceita poucas consultas por minuto
        company = self.cnpjs.get_active_company(cnpj)

        apartment = Apartment(
            manager_id=user.id,
            building_name=_building_name(company),
            zip_code=zip_code,
            building_cnpj=cnpj,
            address=company.address,
        )
        return self._save_new_profile(user, apartment_in, apartment)

    def create_buyer(self, user: User, buyer_in: BuyerCreate) -> ProfileRead:
        self._check_user_has_no_profile(user)
        self._check_cpf_is_new(buyer_in.cpf)
        apartment = self._find_apartment(buyer_in.apartment_public_id)

        buyer = Buyer(
            user_id=user.id,
            apartment_id=apartment.id,
            block=buyer_in.block,
            unit=buyer_in.unit,
        )
        return self._save_new_profile(user, buyer_in, buyer)

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
        if "farm_name" in new_values:
            farmer.farm_name = new_values["farm_name"]
        self._update_zip_code(farmer, new_values)

    def _update_zip_code(self, profile: Farmer | Apartment, new_values: dict) -> None:
        if "zip_code" in new_values:
            zip_code = normalize_cep(new_values["zip_code"])
            if zip_code != profile.zip_code:
                profile.zip_code = self._check_zip_code(zip_code)

    def _update_apartment(self, apartment: Apartment, new_values: dict) -> None:
        new_cnpj = None
        if "building_cnpj" in new_values:
            cnpj = normalize_cnpj(new_values["building_cnpj"])
            if cnpj != apartment.building_cnpj:
                new_cnpj = cnpj

        self._update_zip_code(apartment, new_values)

        if new_cnpj is not None:
            # a CNPJá fica por último porque aceita poucas consultas por minuto
            company = self.cnpjs.get_active_company(new_cnpj)
            apartment.building_cnpj = new_cnpj
            apartment.building_name = _building_name(company)
            apartment.address = company.address

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
            buyer.link_status = LinkStatus.PENDENTE
            buyer.link_requested_at = datetime.now(UTC)
            buyer.link_reviewed_at = None

    def _check_user_has_no_profile(self, user: User) -> None:
        if user.farmer or user.apartment or user.buyer:
            raise ProfileAlreadyExistsError

    def _check_cpf_is_new(self, cpf: str) -> None:
        if self.profiles.get_user_by_cpf(cpf) is not None:
            raise CpfAlreadyRegisteredError

    def _save_new_profile(
        self, user: User, profile_in: ProfileCreate, profile: Profile
    ) -> ProfileRead:
        self.profiles.lock_and_reload(user)
        self._check_user_has_no_profile(user)

        user.cpf = profile_in.cpf
        user.cellphone = profile_in.cellphone
        user.homephone = profile_in.homephone
        self.profiles.add(profile)
        try:
            self.profiles.commit()
        except DuplicateValueError:
            # pode ser o CPF, gravado por outra conta depois da conferência
            if self.profiles.get_user_by_cpf(profile_in.cpf) is not None:
                raise CpfAlreadyRegisteredError from None
            raise
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


def _building_name(company: Company) -> str:
    if company.alias:
        return company.alias
    return company.name
