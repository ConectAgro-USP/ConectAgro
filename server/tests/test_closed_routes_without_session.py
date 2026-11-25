import re
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from src.main import app

ANY_ID = str(uuid4())
# só estas abrem sem sessão, qualquer rota nova pede login
OPEN_ROUTES = {
    ("GET", "/api/health"),
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/logout"),
    ("GET", "/api/auth/login/google"),
    ("GET", "/api/auth/callback/google"),
    ("GET", "/api/products"),
    ("GET", "/api/products/{public_id}"),
    ("GET", "/api/products/{public_id}/picture"),
    ("GET", "/api/farmers/{public_id}/reviews"),
}
ROUTES = sorted(
    (method, route.path)
    for route in app.routes
    if isinstance(route, APIRoute)
    for method in route.methods
)
CLOSED_ROUTES = [route for route in ROUTES if route not in OPEN_ROUTES]


def test_every_open_route_exists():
    assert OPEN_ROUTES <= set(ROUTES)


@pytest.mark.parametrize(("method", "path"), CLOSED_ROUTES)
def test_closed_route_requires_a_session(client: TestClient, method: str, path: str):
    url = re.sub(r"\{[^}]+\}", ANY_ID, path)

    response = client.request(method, url, json={})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
