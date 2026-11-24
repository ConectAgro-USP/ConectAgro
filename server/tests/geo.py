from math import degrees

from src.services.distance_service import EARTH_RADIUS_KM

# a Praça da Sé, onde os testes da busca põem o prédio
PRACA_DA_SE = (-23.5503898, -46.633081)


def km_north(km: float, origin: tuple[float, float] = PRACA_DA_SE) -> tuple[float, float]:
    # o ponto a essa distância em linha reta, seguindo o meridiano
    latitude, longitude = origin
    return latitude + degrees(km / EARTH_RADIUS_KM), longitude
