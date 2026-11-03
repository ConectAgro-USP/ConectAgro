from pydantic import BaseModel, Field

# o PostgreSQL recusa o caractere nulo nos textos que vão ser gravados
WITHOUT_NULL = r"^[^\x00]*$"


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


class Company(BaseModel):
    name: str = Field(max_length=150, pattern=WITHOUT_NULL)
    alias: str | None = Field(default=None, max_length=150, pattern=WITHOUT_NULL)
    registration_status: str
    cep: str | None = Field(default=None, pattern=r"^[0-9]{8}$")
    address: str | None = Field(default=None, max_length=300, pattern=WITHOUT_NULL)
