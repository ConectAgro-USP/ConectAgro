from fastapi import status
from fastapi.testclient import TestClient

SIGNUP = {"name": "Cintia", "email": "cintia@gmail.com", "password": "#NHJgrej4"}


def test_register_does_not_return_the_internal_id(client: TestClient):
    response = client.post("/api/auth/register", json=SIGNUP)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == {"message": "Conta criada com sucesso"}


def test_me_does_not_return_the_internal_id(client: TestClient):
    client.post("/api/auth/register", json=SIGNUP)
    client.post("/api/auth/login", json={"email": SIGNUP["email"], "password": SIGNUP["password"]})

    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_200_OK
    assert set(response.json()) == {
        "email",
        "name",
        "picture_url",
        "cellphone",
        "homephone",
        "created_at",
    }
