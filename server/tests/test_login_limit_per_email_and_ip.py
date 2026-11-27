import pytest
from fastapi import status
from fastapi.testclient import TestClient

from src.api import rate_limits

CREDENTIALS = {"email": "cintia@gmail.com", "password": "#NHJgrej4"}
WRONG_PASSWORD = {**CREDENTIALS, "password": "senha-errada"}


def from_ip(ip: str) -> dict[str, str]:
    return {"X-Forwarded-For": ip}


@pytest.fixture(autouse=True)
def two_attempts(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL_AND_IP, "max_attempts", 2)
    client.post("/api/auth/register", json={"name": "Cintia", **CREDENTIALS})


def test_an_attacker_does_not_lock_the_owner_out_from_another_ip(client: TestClient):
    for _ in range(3):
        client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip("200.1.1.1"))

    attacker = client.post("/api/auth/login", json=CREDENTIALS, headers=from_ip("200.1.1.1"))
    owner = client.post("/api/auth/login", json=CREDENTIALS, headers=from_ip("200.2.2.2"))

    assert attacker.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert owner.status_code == status.HTTP_200_OK


def test_the_same_ip_is_still_limited_per_email(client: TestClient):
    for _ in range(2):
        client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip("200.1.1.1"))

    response = client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip("200.1.1.1"))
    other_email = client.post(
        "/api/auth/login",
        json={**WRONG_PASSWORD, "email": "bia@gmail.com"},
        headers=from_ip("200.1.1.1"),
    )

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert other_email.status_code == status.HTTP_401_UNAUTHORIZED


def test_login_key_joins_email_and_ip():
    assert rate_limits.login_key("a@b.com", "200.1.1.1|") == "a@b.com|200.1.1.1|"
    assert rate_limits.login_key("a@b.com", "1.1.1.1") != rate_limits.login_key(
        "a@b.com", "2.2.2.2"
    )
