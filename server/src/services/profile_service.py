from datetime import UTC, datetime
from uuid import UUID

from src.connectors.brasilapi import BrasilApiConnector
from src.models.apartment import Apartment
from src.models.buyer import Buyer, LinkStatus
from src.models.farmer import Farmer
from src.models.profile import (
    ApartmentCreate,
    ApartmentRead,
    BuyerCreate,
    BuyerRead,
    FarmerCreate,
    FarmerRead,
    ProfileRead,
    ProfileType,
    ProfileUpdate,
)
from src.models.user import User
from src.repository.profile_repository import DuplicateProfileDataError, ProfileRepository
from src.services.cnpj_service import CnpjService, normalize_cnpj
from src.services.exceptions import (
    ApartmentNotFoundError,
    CepWithoutCoordinatesError,
    CnpjAlreadyRegisteredError,
    FieldNotInProfileError,
    LinkPendingError,
    LinkRejectedError,
    ProfileAlreadyExistsError,
    ProfileNotFoundError,
)

USER_FIELDS = ["name", "cellphone", "homephone"]
FARMER_FIELDS = ["zip_code"]
APARTMENT_FIELDS = ["building_name", "zip_code", "building_cnpj"]
BUYER_FIELDS = ["apartment_public_id", "block", "unit"]


class ProfileService:
    def __init__(self, profiles: ProfileRepository, ceps: BrasilApiConnector, cnpjs: CnpjService):
        self.profiles = profiles
        self.ceps = ceps
        self.cnpjs = cnpjs

    def get_profile(self, user: User) -> ProfileRead:
        profile = ProfileRead(
            name=user.name,
            email=user.email,
            picture_url=user.picture_url,
            cellphone=user.cellphone,
            homephone=user.homephone,
        )

        farmer = self.profiles.get_farmer_of_user(user.id)
        if farmer is not None:
            profile.profile_type = ProfileType.FARMER
            profile.farmer = FarmerRead.model_validate(farmer)

        apartment = self.profiles.get_apartment_of_manager(user.id)
        if apartment is not None:
            profile.profile_type = ProfileType.APARTMENT
            profile.apartment = ApartmentRead.model_validate(apartment)

        buyer = self.profiles.get_buyer_of_user(user.id)
        if buyer is not None:
            profile.profile_type = ProfileType.BUYER
            profile.buyer = BuyerRead.model_validate(buyer)

        return profile

    def get_farmer(self, user: User) -> Farmer:
        farmer = self.profiles.get_farmer_of_user(user.id)
        if farmer is None:
            raise ProfileNotFoundError
        return farmer

    def get_apartment(self, user: User) -> Apartment:
        apartment = self.profiles.get_apartment_of_manager(user.id)
        if apartment is None:
            raise ProfileNotFoundError
        return apartment

    def get_approved_buyer(self, user: User) -> Buyer:
        buyer = self.profiles.get_buyer_of_user(user.id)
        if buyer is None:
            raise ProfileNotFoundError
        if buyer.link_status == LinkStatus.PENDENTE:
            raise LinkPendingError
        if buyer.link_status != LinkStatus.APROVADO:
            raise LinkRejectedError
        return buyer

    def create_farmer(self, user: User, farmer_in: FarmerCreate) -> ProfileRead:
        self._lock_user_and_check_no_profile(user)
        zip_code = self._check_zip_code(farmer_in.zip_code)

        farmer = Farmer(user_id=user.id, zip_code=zip_code)
        self.profiles.add(farmer)
        try:
            self.profiles.commit()
        except DuplicateProfileDataError:
            raise ProfileAlreadyExistsError from None
        return self.get_profile(user)

    def create_apartment(self, user: User, apartment_in: ApartmentCreate) -> ProfileRead:
        self._lock_user_and_check_no_profile(user)
        cnpj = normalize_cnpj(apartment_in.building_cnpj)
        self._check_cnpj_is_free(cnpj)
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
        self.profiles.add(apartment)
        try:
            self.profiles.commit()
        except DuplicateProfileDataError:
            # com o usuário travado, só o CNPJ pode repetir
            raise CnpjAlreadyRegisteredError from None
        return self.get_profile(user)

    def create_buyer(self, user: User, buyer_in: BuyerCreate) -> ProfileRead:
        self._lock_user_and_check_no_profile(user)
        apartment = self._find_apartment(buyer_in.apartment_public_id)

        buyer = Buyer(
            user_id=user.id,
            apartment_id=apartment.id,
            block=buyer_in.block,
            unit=buyer_in.unit,
        )
        self.profiles.add(buyer)
        try:
            self.profiles.commit()
        except DuplicateProfileDataError:
            raise ProfileAlreadyExistsError from None
        return self.get_profile(user)

    def update_profile(self, user: User, changes: ProfileUpdate) -> ProfileRead:
        new_values = changes.model_dump(exclude_unset=True)
        farmer = self.profiles.get_farmer_of_user(user.id)
        apartment = self.profiles.get_apartment_of_manager(user.id)
        buyer = self.profiles.get_buyer_of_user(user.id)
        self._check_allowed_fields(new_values, farmer, apartment, buyer)

        if farmer is not None:
            self._update_farmer(farmer, new_values)
        if apartment is not None:
            self._update_apartment(apartment, new_values)
        if buyer is not None:
            self._update_buyer(buyer, new_values)
        # usuário por último: buscas no banco o gravariam antes das APIs
        self._update_user(user, new_values)

        try:
            self.profiles.commit()
        except DuplicateProfileDataError:
            # o CNPJ do prédio é o único campo único que dá para editar
            raise CnpjAlreadyRegisteredError from None
        return self.get_profile(user)

    def _check_allowed_fields(
        self,
        new_values: dict,
        farmer: Farmer | None,
        apartment: Apartment | None,
        buyer: Buyer | None,
    ) -> None:
        allowed_fields = []
        allowed_fields.extend(USER_FIELDS)
        if farmer is not None:
            allowed_fields.extend(FARMER_FIELDS)
        if apartment is not None:
            allowed_fields.extend(APARTMENT_FIELDS)
        if buyer is not None:
            allowed_fields.extend(BUYER_FIELDS)

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
            if not _same_zip_code(new_values["zip_code"], farmer.zip_code):
                farmer.zip_code = self._check_zip_code(new_values["zip_code"])

    def _update_apartment(self, apartment: Apartment, new_values: dict) -> None:
        # a busca do CNPJ no banco vem antes das mudanças, senão já as gravaria
        new_cnpj = None
        if "building_cnpj" in new_values:
            cnpj = normalize_cnpj(new_values["building_cnpj"])
            if cnpj != apartment.building_cnpj:
                self._check_cnpj_is_free(cnpj)
                new_cnpj = cnpj

        if "zip_code" in new_values:
            if not _same_zip_code(new_values["zip_code"], apartment.zip_code):
                apartment.zip_code = self._check_zip_code(new_values["zip_code"])

        if "building_name" in new_values:
            apartment.building_name = new_values["building_name"]

        if new_cnpj is not None:
            # a CNPJá fica por último porque aceita poucas consultas por minuto
            self.cnpjs.validate(new_cnpj)
            apartment.building_cnpj = new_cnpj

    def _update_buyer(self, buyer: Buyer, new_values: dict) -> None:
        changes_link = (
            "apartment_public_id" in new_values or "block" in new_values or "unit" in new_values
        )
        if not changes_link:
            return

        # trava o morador para a troca não cruzar com a decisão do síndico
        self.profiles.lock_buyer(buyer)
        if "apartment_public_id" in new_values:
            apartment = self._find_apartment(new_values["apartment_public_id"])
            buyer.apartment_id = apartment.id
        if "block" in new_values:
            buyer.block = new_values["block"]
        if "unit" in new_values:
            buyer.unit = new_values["unit"]

        # mudar prédio, bloco ou número pede uma nova aprovação do síndico
        buyer.link_status = LinkStatus.PENDENTE
        buyer.link_requested_at = datetime.now(UTC)
        buyer.link_reviewed_at = None

    def _lock_user_and_check_no_profile(self, user: User) -> None:
        # a trava impede que dois pedidos ao mesmo tempo criem dois perfis
        self.profiles.lock_user(user)
        if self.profiles.get_farmer_of_user(user.id) is not None:
            raise ProfileAlreadyExistsError
        if self.profiles.get_apartment_of_manager(user.id) is not None:
            raise ProfileAlreadyExistsError
        if self.profiles.get_buyer_of_user(user.id) is not None:
            raise ProfileAlreadyExistsError

    def _check_cnpj_is_free(self, cnpj: str) -> None:
        if self.profiles.get_apartment_by_cnpj(cnpj) is not None:
            raise CnpjAlreadyRegisteredError

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


def _same_zip_code(new_zip_code: str, saved_zip_code: str) -> bool:
    saved_with_dash = saved_zip_code[:5] + "-" + saved_zip_code[5:]
    return new_zip_code == saved_zip_code or new_zip_code == saved_with_dash
