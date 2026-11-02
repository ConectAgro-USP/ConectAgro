from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, ConfigDict, StringConstraints
from sqlmodel import Field, SQLModel

from src.services.phone_service import validate_cellphone, validate_homephone
from src.services.text_service import reject_null_character

from .buyer import LinkStatus
from .user import PersonName

# só limitam o tamanho; o formato do CEP e do CNPJ é conferido depois
ZipCode = Annotated[str, StringConstraints(strip_whitespace=True, max_length=9)]
Cnpj = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]
BuildingName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=100),
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
# o limite vem antes da validação, para um texto enorme não custar caro
CellPhoneInput = Annotated[
    str, StringConstraints(max_length=20), AfterValidator(validate_cellphone)
]
HomePhoneInput = Annotated[
    str, StringConstraints(max_length=20), AfterValidator(validate_homephone)
]
FORBID_UNKNOWN_FIELDS = ConfigDict(extra="forbid")


class ProfileType(StrEnum):
    FARMER = "farmer"
    APARTMENT = "apartment"
    BUYER = "buyer"


class FarmerCreate(SQLModel):
    model_config = FORBID_UNKNOWN_FIELDS

    zip_code: ZipCode


class ApartmentCreate(SQLModel):
    model_config = FORBID_UNKNOWN_FIELDS

    building_name: BuildingName
    zip_code: ZipCode
    manager_name: PersonName
    building_cnpj: Cnpj


class BuyerCreate(SQLModel):
    model_config = FORBID_UNKNOWN_FIELDS

    apartment_public_id: UUID
    block: Block | None = None
    unit: Unit


class FarmerRead(SQLModel):
    public_id: UUID
    zip_code: str


class ApartmentRead(SQLModel):
    public_id: UUID
    building_name: str
    zip_code: str
    building_cnpj: str


class ApartmentSummary(SQLModel):
    public_id: UUID
    building_name: str
    zip_code: str


class BuyerRead(SQLModel):
    public_id: UUID
    apartment: ApartmentSummary | None
    block: str | None
    unit: str
    link_status: LinkStatus
    link_requested_at: datetime
    link_reviewed_at: datetime | None


class ProfileRead(SQLModel):
    profile_type: ProfileType | None = None
    name: str
    email: str
    picture_url: str | None
    cellphone: str | None
    homephone: str | None
    farmer: FarmerRead | None = None
    apartment: ApartmentRead | None = None
    buyer: BuyerRead | None = None


class ProfileUpdate(SQLModel):
    model_config = FORBID_UNKNOWN_FIELDS

    # default None = campo não enviado; o tipo sem None recusa null explícito
    name: PersonName = Field(default=None)
    cellphone: CellPhoneInput | None = None
    homephone: HomePhoneInput | None = None
    zip_code: ZipCode = Field(default=None)
    building_name: BuildingName = Field(default=None)
    building_cnpj: Cnpj = Field(default=None)
    apartment_public_id: UUID = Field(default=None)
    block: Block | None = None
    unit: Unit = Field(default=None)


class ResidentUser(SQLModel):
    name: str
    email: str


class ResidentRead(SQLModel):
    public_id: UUID
    user: ResidentUser
    block: str | None
    unit: str
    link_status: LinkStatus
    link_requested_at: datetime
    link_reviewed_at: datetime | None
