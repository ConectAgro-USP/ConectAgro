from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class Address(BaseModel):
    cep: str = Field(pattern=r"^[0-9]{8}$")
    state: str
    city: str
    neighborhood: str | None = None
    street: str | None = None
    coordinates: Coordinates | None = None


class Route(BaseModel):
    distance_m: float = Field(ge=0, allow_inf_nan=False)
    duration_s: float = Field(ge=0, allow_inf_nan=False)
