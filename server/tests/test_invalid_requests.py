import pytest
from fastapi import status
from fastapi.testclient import TestClient

URL = "/api/auth/register"
SIGNUP = {"name": "Ana Souza", "email": "ana@example.com", "password": "12345678"}


@pytest.mark.parametrize(
    "body",
    [b'{"password": NaN}', b'{"name": "a\\ud800b"}'],
    ids=["nan", "caractere-quebrado"],
)
def test_value_that_does_not_fit_in_json_returns_422(client: TestClient, body: bytes):
    response = client.post(URL, content=body, headers={"content-type": "application/json"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_invalid_field_is_named_without_sending_its_value_back(client: TestClient):
    response = client.post(URL, json=SIGNUP | {"password": "curta"})

    [error] = response.json()["detail"]
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert set(error) == {"type", "loc", "msg"}
    assert (error["type"], error["loc"]) == ("string_too_short", ["body", "password"])
    assert "curta" not in response.text
