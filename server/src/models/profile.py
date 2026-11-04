from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, ConfigDict, StringConstraints
from sqlmodel import Field, SQLModel

from src.services.text_service import reject_null_character

from .buyer import LinkStatus
from .user import CellPhone, Cpf, HomePhone, PersonName

# só limitam o tamanho; o formato do CEP e do CNPJ é conferido depois
ZipCode = Annotated[str, StringConstraints(strip_whitespace=True, max_length=9)]
Cnpj = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]
FarmName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=150),
    AfterValidator(reject_null_character),
]
Block = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=10),
    AfterValidator(reject_null_character),
]
Unit = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=10),
    AfterValidator(reject_null_character),
]
FORBID_UNKNOWN_FIELDS = ConfigDict(extra="forbid")


class ProfileType(StrEnum):
    FARMER = "farmer"
    APARTMENT = "apartment"
    BUYER = "buyer"


class ProfileCreate(SQLModel):
    model_config = FORBID_UNKNOWN_FIELDS

    cpf: Cpf
    cellphone: CellPhone
    homephone: HomePhone | None = None


class FarmerCreate(ProfileCreate):
    farm_name: FarmName
    zip_code: ZipCode


class ApartmentCreate(ProfileCreate):
    building_cnpj: Cnpj
    zip_code: ZipCode


class BuyerCreate(ProfileCreate):
    apartment_public_id: UUID
    block: Block | None = None
    unit: Unit


class FarmerRead(SQLModel):
    public_id: UUID
    farm_name: str | None
    zip_code: str


class ApartmentPreview(SQLModel):
    building_name: str
    zip_code: str | None
    address: str | None


class ApartmentSummary(SQLModel):
    public_id: UUID
    building_name: str
    building_cnpj: str
    zip_code: str
    address: str | None


class ApartmentMatch(ApartmentSummary):
    # nome e endereço vêm da CNPJá; o síndico diferencia prédios com o mesmo CNPJ
    manager_short_name: str


class BuyerSummary(SQLModel):
    public_id: UUID
    block: str | None
    unit: str
    link_status: LinkStatus
    link_requested_at: datetime
    link_reviewed_at: datetime | None


class BuyerRead(BuyerSummary):
    apartment: ApartmentSummary | None


class ProfileRead(SQLModel):
    profile_type: ProfileType | None = None
    name: str
    email: str
    picture_url: str | None
    cellphone: str | None
    homephone: str | None
    farmer: FarmerRead | None = None
    apartment: ApartmentSummary | None = None
    buyer: BuyerRead | None = None


class ProfileUpdate(SQLModel):
    model_config = FORBID_UNKNOWN_FIELDS

    # default None = campo não enviado; o tipo sem None recusa null explícito
    name: PersonName = Field(default=None)
    cellphone: CellPhone | None = None
    homephone: HomePhone | None = None
    farm_name: FarmName = Field(default=None)
    zip_code: ZipCode = Field(default=None)
    building_cnpj: Cnpj = Field(default=None)
    apartment_public_id: UUID = Field(default=None)
    block: Block | None = None
    unit: Unit = Field(default=None)


class ResidentUser(SQLModel):
    name: str


class ResidentRead(BuyerSummary):
    user: ResidentUser
