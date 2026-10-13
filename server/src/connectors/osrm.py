import httpx
from pydantic import ValidationError

from src.connectors.exceptions import ExternalServiceError, RouteNotFoundError
from src.connectors.http import DEFAULT_TIMEOUT, get_json
from src.connectors.models import Coordinates, Route

OSRM_URL = "https://router.project-osrm.org"
_CODE_ERRORS = {"NoRoute": RouteNotFoundError, "NoSegment": RouteNotFoundError}


class OsrmConnector:
    def __init__(
        self, client: httpx.Client, base_url: str = OSRM_URL, timeout: float = DEFAULT_TIMEOUT
    ):
        self.client = client
        self.base_url = base_url
        self.timeout = timeout

    def get_route(self, origin: Coordinates, destination: Coordinates) -> Route:
        points = f"{_lon_lat(origin)};{_lon_lat(destination)}"
        url = f"{self.base_url}/route/v1/driving/{points}?overview=false"
        status, body = get_json(self.client, url, self.timeout)
        try:
            code = body.get("code")
            if (status, code) != (200, "Ok"):
                error_type = _CODE_ERRORS.get(code, ExternalServiceError)
                raise error_type(f"OSRM respondeu {status} ({code})")
            route = body["routes"][0]
            return Route(distance_m=route["distance"], duration_s=route["duration"])
        except (AttributeError, KeyError, IndexError, TypeError, ValidationError) as exc:
            raise ExternalServiceError("resposta inesperada do OSRM") from exc


def _lon_lat(point: Coordinates) -> str:
    # o OSRM recebe longitude antes de latitude, e casas fixas evitam notação científica
    return f"{point.longitude:.6f},{point.latitude:.6f}"
