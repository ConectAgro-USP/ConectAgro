import pytest
from fastapi import Request, status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.api import rate_limits
from src.models.user import User
from src.services.auth_service import AuthService
from src.services.exceptions import InvalidCredentialsError
from tests.helpers import add_user, login

CREDENTIALS = {"email": "cintia@gmail.com", "password": "#NHJgrej4"}
WRONG_PASSWORD = {**CREDENTIALS, "password": "senha-errada"}
SIGNUP = {"name": "Cintia", **CREDENTIALS}
# a prévia recusa este CNPJ sem chamar o CNPJá
CNPJ_WITH_WRONG_DIGIT = "00.000.000/0001-90"


def from_ip(ip: str) -> dict[str, str]:
    return {"X-Forwarded-For": f"{ip}, 10.0.0.1"}


def make_request(
    headers: dict[str, str], connection: tuple[str, int] | None = ("10.0.0.2", 443)
) -> Request:
    raw_headers = [(name.encode(), value.encode()) for name, value in headers.items()]
    return Request({"type": "http", "headers": raw_headers, "client": connection})


def test_wrong_passwords_block_the_email_even_with_the_right_password(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 2)
    client.post("/api/auth/register", json=SIGNUP)
    for _ in range(2):
        client.post("/api/auth/login", json=WRONG_PASSWORD)

    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert response.json()["detail"] == "Muitas tentativas. Tente novamente mais tarde"


def test_the_email_limit_is_case_insensitive(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 2)
    client.post("/api/auth/register", json=SIGNUP)
    for email in ["CINTIA@GMAIL.COM", " Cintia@Gmail.com "]:
        client.post("/api/auth/login", json={**WRONG_PASSWORD, "email": email})

    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_the_right_password_neither_counts_nor_erases_the_failures(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 2)
    client.post("/api/auth/register", json=SIGNUP)
    client.post("/api/auth/login", json=WRONG_PASSWORD)
    for _ in range(3):
        client.post("/api/auth/login", json=CREDENTIALS)

    second_failure = client.post("/api/auth/login", json=WRONG_PASSWORD)
    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert second_failure.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_a_login_counts_its_attempt_before_checking_the_password(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 1)
    blocked_while_checking = []

    def fake_authenticate(self, email, password):
        blocked_while_checking.append(rate_limits.LOGIN_FAILURES_PER_EMAIL.is_blocked(email))
        raise InvalidCredentialsError

    monkeypatch.setattr(AuthService, "authenticate", fake_authenticate)
    client.post("/api/auth/login", json=CREDENTIALS)

    assert blocked_while_checking == [True]


def test_a_server_error_gives_the_attempt_of_the_email_back(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 1)

    def failing_authenticate(self, email, password):
        raise RuntimeError("banco fora do ar")

    monkeypatch.setattr(AuthService, "authenticate", failing_authenticate)
    with pytest.raises(RuntimeError):
        client.post("/api/auth/login", json=CREDENTIALS)

    assert not rate_limits.LOGIN_FAILURES_PER_EMAIL.is_blocked(CREDENTIALS["email"])


def test_wrong_passwords_on_many_emails_block_the_ip(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_IP, "max_attempts", 2)
    client.post("/api/auth/register", json=SIGNUP)
    for email in ["ana@gmail.com", "bia@gmail.com"]:
        wrong_login = {**WRONG_PASSWORD, "email": email}
        client.post("/api/auth/login", json=wrong_login, headers=from_ip("200.1.1.1"))

    blocked = client.post("/api/auth/login", json=CREDENTIALS, headers=from_ip("200.1.1.1"))
    other_ip = client.post("/api/auth/login", json=CREDENTIALS, headers=from_ip("200.2.2.2"))

    assert blocked.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert other_ip.status_code == status.HTTP_200_OK


def test_right_passwords_do_not_count_against_the_ip(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_IP, "max_attempts", 2)
    client.post("/api/auth/register", json=SIGNUP)
    for _ in range(2):
        client.post("/api/auth/login", json=CREDENTIALS)

    response = client.post("/api/auth/login", json=WRONG_PASSWORD)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_a_refusal_by_the_ip_does_not_use_the_limit_of_the_email(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_IP, "max_attempts", 1)
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 2)
    for _ in range(2):
        client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip("200.1.1.1"))

    response = client.post("/api/auth/login", json=WRONG_PASSWORD, headers=from_ip("200.2.2.2"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_a_refusal_by_the_email_does_not_use_the_limit_of_the_ip(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_EMAIL, "max_attempts", 1)
    monkeypatch.setattr(rate_limits.LOGIN_FAILURES_PER_IP, "max_attempts", 2)
    for _ in range(3):
        client.post("/api/auth/login", json=WRONG_PASSWORD)

    response = client.post("/api/auth/login", json={**WRONG_PASSWORD, "email": "bia@gmail.com"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_sign_ups_are_limited_by_ip(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(rate_limits.SIGNUPS_PER_IP, "max_attempts", 2)
    for email in ["ana@gmail.com", "bia@gmail.com"]:
        client.post("/api/auth/register", json={**SIGNUP, "email": email})

    blocked = client.post("/api/auth/register", json=SIGNUP)
    other_ip = client.post("/api/auth/register", json=SIGNUP, headers=from_ip("200.2.2.2"))

    assert blocked.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert other_ip.status_code == status.HTTP_201_CREATED


def test_a_forged_ip_never_uses_the_limit_of_the_real_one(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.SIGNUPS_PER_IP, "max_attempts", 1)
    forged_on_render = {"X-Forwarded-For": "200.1.1.1", "CF-Connecting-IP": "198.51.100.7"}
    through_vercel = {"X-Forwarded-For": "200.1.1.1", "CF-Connecting-IP": "203.0.113.5"}
    forged_signup = {**SIGNUP, "email": "ana@gmail.com"}
    client.post("/api/auth/register", json=forged_signup, headers=forged_on_render)

    response = client.post("/api/auth/register", json=SIGNUP, headers=through_vercel)

    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", f"/api/profiles/apartment/preview?cnpj={CNPJ_WITH_WRONG_DIGIT}"),
        ("POST", "/api/profiles/farmer"),
        ("POST", "/api/profiles/apartment"),
        ("POST", "/api/profiles/buyer"),
        ("PATCH", "/api/profiles/me"),
    ],
    ids=["previa", "agricultor", "sindico", "morador", "edicao"],
)
def test_every_profile_request_uses_the_limit_of_the_account(
    method: str, path: str, client: TestClient, ana: User, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PROFILE_REQUESTS_PER_USER, "max_attempts", 1)
    rate_limits.PROFILE_REQUESTS_PER_USER.count_attempt(str(ana.id))

    response = client.request(method, path)

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_reading_the_profile_is_not_limited(
    client: TestClient, ana: User, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PROFILE_REQUESTS_PER_USER, "max_attempts", 1)
    rate_limits.PROFILE_REQUESTS_PER_USER.count_attempt(str(ana.id))

    response = client.get("/api/profiles/me")

    assert response.status_code == status.HTTP_200_OK


def test_profile_requests_of_many_accounts_block_the_ip(
    client: TestClient, session: Session, ana: User, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PROFILE_REQUESTS_PER_IP, "max_attempts", 1)
    client.patch("/api/profiles/me", json={"name": "Ana Lima"})
    login(client, add_user(session, "bia@example.com"))

    response = client.patch("/api/profiles/me", json={"name": "Bia Lima"})

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_a_refusal_by_the_account_does_not_use_the_limit_of_the_ip(
    client: TestClient, session: Session, ana: User, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PROFILE_REQUESTS_PER_USER, "max_attempts", 1)
    monkeypatch.setattr(rate_limits.PROFILE_REQUESTS_PER_IP, "max_attempts", 2)
    for _ in range(3):
        client.patch("/api/profiles/me", json={"name": "Ana Lima"})
    login(client, add_user(session, "bia@example.com"))

    response = client.patch("/api/profiles/me", json={"name": "Bia Lima"})

    assert response.status_code == status.HTTP_200_OK


def test_a_refusal_by_the_ip_does_not_use_the_limit_of_the_account(
    client: TestClient, ana: User, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(rate_limits.PROFILE_REQUESTS_PER_IP, "max_attempts", 1)
    monkeypatch.setattr(rate_limits.PROFILE_REQUESTS_PER_USER, "max_attempts", 2)
    new_name = {"name": "Ana Lima"}
    for _ in range(2):
        client.patch("/api/profiles/me", json=new_name, headers=from_ip("200.1.1.1"))

    response = client.patch("/api/profiles/me", json=new_name, headers=from_ip("200.2.2.2"))

    assert response.status_code == status.HTTP_200_OK


def test_ip_key_pairs_the_visitor_with_who_connected_to_the_api():
    request = make_request(
        {"x-forwarded-for": "200.1.1.1, 10.0.0.1", "cf-connecting-ip": "203.0.113.5"}
    )

    assert rate_limits.get_ip_key(request) == "200.1.1.1|203.0.113.5"


@pytest.mark.parametrize(
    "forwarded_for",
    ["x" * 8000, "fe80::1%" + "a" * 100, "nao-e-um-ip", ""],
    ids=["enorme", "ipv6-com-zona-enorme", "texto", "vazio"],
)
def test_ip_key_keeps_only_real_ips(forwarded_for: str):
    request = make_request({"x-forwarded-for": forwarded_for, "cf-connecting-ip": "203.0.113.5"})

    assert rate_limits.get_ip_key(request) == "|203.0.113.5"


def test_ip_key_writes_each_ip_in_a_single_way():
    request = make_request({"x-forwarded-for": "2001:0db8:0000:0000:0000:0000:0000:0001"})

    assert rate_limits.get_ip_key(request) == "2001:db8::1|"


def test_ip_key_falls_back_to_the_connection():
    assert rate_limits.get_ip_key(make_request({})) == "10.0.0.2"
    assert rate_limits.get_ip_key(make_request({}, connection=None)) == ""
