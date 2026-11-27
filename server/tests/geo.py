from math import degrees

from sqlmodel import Session

from src.connectors.models import Address, Coordinates
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.services.distance_service import EARTH_RADIUS_KM

# a Praça da Sé, onde os testes da busca põem o prédio
PRACA_DA_SE = (-23.5503898, -46.633081)
PRACA_DA_SE_ADDRESS = Address(
    cep="01001000",
    state="SP",
    city="São Paulo",
    coordinates=Coordinates(latitude=PRACA_DA_SE[0], longitude=PRACA_DA_SE[1]),
)
# coordenadas que a BrasilAPI dá na resposta PAULISTA, do CEP 01310200
PAULISTA_POINT = (-23.5475, -46.63611)


def km_north(km: float, origin: tuple[float, float] = PRACA_DA_SE) -> tuple[float, float]:
    # o ponto a essa distância em linha reta, seguindo o meridiano
    latitude, longitude = origin
    return latitude + degrees(km / EARTH_RADIUS_KM), longitude


def point_of(profile: Apartment | Farmer) -> tuple[float | None, float | None]:
    return profile.latitude, profile.longitude


def locate(session: Session, building: Apartment) -> None:
    building.latitude, building.longitude = PRACA_DA_SE
    session.commit()
