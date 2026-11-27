from math import radians

import pytest
from haversine import inverse_haversine

from src.services.distance_service import bounding_box, km_between
from tests.geo import PRACA_DA_SE, km_north


def inside(point: tuple[float, float], radius_km: float) -> bool:
    box = bounding_box(PRACA_DA_SE, radius_km)
    latitude, longitude = point
    return (
        box.min_latitude <= latitude <= box.max_latitude
        and box.min_longitude <= longitude <= box.max_longitude
    )


@pytest.mark.parametrize("radius_km", [5, 10, 15])
def test_bounding_box_holds_the_whole_circle(radius_km: int):
    # pontos na borda do círculo, de grau em grau
    border = [
        inverse_haversine(PRACA_DA_SE, radius_km * 0.9999, radians(degree)) for degree in range(360)
    ]

    assert all(inside(point, radius_km) for point in border)


@pytest.mark.parametrize("radius_km", [5, 10, 15])
def test_bounding_box_leaves_out_points_beyond_the_radius(radius_km: int):
    north = km_north(radius_km + 0.01)
    east = inverse_haversine(PRACA_DA_SE, radius_km * 1.01, radians(90))

    assert not inside(north, radius_km)
    assert not inside(east, radius_km)


def test_km_between_follows_the_meridian_helper():
    assert round(km_between(PRACA_DA_SE, km_north(4)), 2) == 4.0
