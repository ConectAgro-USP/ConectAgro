import pytest
from fastapi import status
from fastapi.testclient import TestClient

from src.api import rate_limits

CREDENTIALS = {"email": "cintia@gmail.com", "password": "#NHJgrej4"}
WRONG_PASSWORD = {**CREDENTIALS, "password": "senha-errada"}


def from_ip(number: int) -> dict[str, str]:
    return {"X-Forwarded-For": f"200.1.{number // 250}.{number % 250 + 1}"}


@pytest.fixture(autouse=True)
def three_failures_per_account(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 3)
    client.post("/api/auth/register", json={"name": "Cintia", **CREDENTIALS})


def fail_from_new_ips(client: TestClient, times: int) -> None:
    for number in range(times):
        response = client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip(number))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_changing_ip_does_not_escape_the_account_limit(client: TestClient):
    fail_from_new_ips(client, 3)

    response = client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip(99))

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert response.json() == {"detail": rate_limits.TOO_MANY_ATTEMPTS}


def test_below_the_account_limit_the_owner_still_logs_in(client: TestClient):
    fail_from_new_ips(client, 2)

    response = client.post("/api/auth/login", json=CREDENTIALS, headers=from_ip(99))

    assert response.status_code == status.HTTP_200_OK


def test_successful_logins_do_not_count_toward_the_account_limit(client: TestClient):
    for number in range(5):
        response = client.post("/api/auth/login", json=CREDENTIALS, headers=from_ip(number))
        assert response.status_code == status.HTTP_200_OK

    fail_from_new_ips(client, 2)


def test_other_accounts_are_not_limited(client: TestClient):
    fail_from_new_ips(client, 3)

    response = client.post(
        "/api/auth/login",
        json={**WRONG_PASSWORD, "email": "bia@gmail.com"},
        headers=from_ip(99),
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_a_blocked_account_does_not_spend_the_email_and_ip_counter(client: TestClient):
    fail_from_new_ips(client, 3)
    blocked_ip = from_ip(99)["X-Forwarded-For"]

    client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip(99))

    key = rate_limits.login_key(CREDENTIALS["email"], f"{blocked_ip}|")
    assert not rate_limits.LOGIN_FAILURES_PER_EMAIL_AND_IP.is_blocked(key)


def test_the_account_limit_is_fifty_failures_in_fifteen_minutes(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.undo()

    assert rate_limits.LOGIN_FAILURES_PER_EMAIL.max_attempts == 50
    assert rate_limits.LOGIN_FAILURES_PER_EMAIL.window_seconds == 15 * rate_limits.MINUTE
