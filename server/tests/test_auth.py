from fastapi import status
from fastapi.testclient import TestClient

user_sign_in = {
  'name': "Cintia",
  'email': "cintia@gmail.com",
  'password': "#NHJgrej4",
  'zip_code': "01000-000"
}

user_login = {
  "email": "cintia@gmail.com",
  "password": "#NHJgrej4",
}


def test_register(client: TestClient):
    response = client.post("/api/auth/register", json = user_sign_in)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["message"] == "Conta criada com sucesso"


def test_register_duplicate_email(client: TestClient):
    client.post("/api/auth/register", json = user_sign_in)
    
    user_repeated_email = user_sign_in.copy()
    user_repeated_email['name'] = "Arminda"
    user_repeated_email['password'] = "re$-$f56fd"
    user_repeated_email['zip_code'] = "01980-066"
    
    response = client.post("/api/auth/register", json = user_repeated_email)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "E-mail já cadastrado" in response.json()["detail"]


def test_login_success(client: TestClient):
    client.post("/api/auth/register", json = user_sign_in)
    response = client.post("/api/auth/login", json = user_login)

    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.cookies


def test_login_wrong_password(client: TestClient):
    client.post("/api/auth/register", json = user_sign_in)

    user_wrong_password = user_login.copy()
    user_wrong_password['password'] = "123456"

    response = client.post("/api/auth/login", json = user_wrong_password)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "E-mail ou senha incorretos" in response.json()["detail"]