from datetime import timedelta
from uuid import uuid4

from fastapi import status
from fastapi.testclient import TestClient
from sqlmodel import Session

from src.models.apartment import Apartment
from src.models.buyer import LinkStatus
from src.models.interest import Interest
from src.models.product import _today
from src.models.user import User
from tests.helpers import (
    add_building,
    add_farmer,
    add_product,
    add_resident,
    add_user,
    login,
)

UNKNOWN_ID = uuid4()


def test_resident_creates_interest_successfully(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )
    product = add_product(session, farmer, name="Alface")
    login(client, resident_user)

    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 3},
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["quantity"] == 3
    assert data["buyer_public_id"] == str(resident.public_id)
    assert data["product_public_id"] == str(product.public_id)
    assert data["product_name"] == "Alface"
    assert data["product_status"] == "Disponível"
    assert "public_id" in data
    assert "created_at" in data
    assert data["updated_at"] is None


def test_create_interest_rejects_invalid_quantity(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)
    product = add_product(session, farmer, name="Alface")
    login(client, resident_user)

    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 0},
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_interest_rejects_unknown_product(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    resident_user = add_user(session, "resident@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)
    login(client, resident_user)

    response = client.post(
        "/api/interests",
        json={"product_public_id": str(UNKNOWN_ID), "quantity": 2},
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Produto não encontrado"


def test_create_interest_rejects_duplicate_product_for_same_buyer(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )
    product = add_product(session, farmer, name="Alface")
    session.add(Interest(buyer_id=resident.id, product_id=product.id, quantity=1))
    session.commit()
    login(client, resident_user)

    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 4},
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "Interesse nesse produto já registrado"


def test_create_interest_allows_different_residents_for_same_product(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    res1_user = add_user(session, "res1@example.com")
    res1 = add_resident(session, building, res1_user, link_status=LinkStatus.APROVADO)
    res2_user = add_user(session, "res2@example.com")
    add_resident(session, building, res2_user, link_status=LinkStatus.APROVADO)
    product = add_product(session, farmer, name="Alface")
    session.add(Interest(buyer_id=res1.id, product_id=product.id, quantity=1))
    session.commit()

    login(client, res2_user)
    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 5},
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["quantity"] == 5


def test_create_interest_permissions(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer_user = add_user(session, "farmer@example.com")
    farmer = add_farmer(session, farmer_user)
    product = add_product(session, farmer, name="Alface")

    # Anônimo
    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 1},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # Agricultor (sem perfil de comprador)
    login(client, farmer_user)
    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 1},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "apenas para moradores" in response.json()["detail"]

    # Morador com vínculo pendente
    pending_user = add_user(session, "pending@example.com")
    add_resident(session, building, pending_user, link_status=LinkStatus.PENDENTE)
    login(client, pending_user)
    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 1},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "aguardando aprovação" in response.json()["detail"]

    # Morador com vínculo recusado
    rejected_user = add_user(session, "rejected@example.com")
    add_resident(session, building, rejected_user, link_status=LinkStatus.RECUSADO)
    login(client, rejected_user)
    response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 1},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "recusado" in response.json()["detail"]


def test_resident_lists_only_their_interests(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )
    other_resident = add_resident(
        session,
        building,
        add_user(session, "other-resident@example.com"),
        link_status=LinkStatus.APROVADO,
    )
    resident_product = add_product(session, farmer, name="Alface")
    other_product = add_product(session, farmer, name="Couve")
    session.add_all(
        [
            Interest(
                buyer_id=resident.id,
                product_id=resident_product.id,
                quantity=2,
            ),
            Interest(
                buyer_id=other_resident.id,
                product_id=other_product.id,
                quantity=5,
            ),
        ]
    )
    session.commit()
    login(client, resident_user)

    response = client.get("/api/interests/me")

    assert response.status_code == status.HTTP_200_OK
    interests = response.json()["items"]
    assert len(interests) == 1
    assert interests[0]["quantity"] == 2
    assert interests[0]["buyer_public_id"] == str(resident.public_id)
    assert interests[0]["product_public_id"] == str(resident_product.public_id)


def test_interest_remains_after_product_is_deleted(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer_user = add_user(session, "farmer@example.com")
    farmer = add_farmer(session, farmer_user)
    product = add_product(session, farmer, name="Alface")
    resident_user = add_user(session, "resident@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)

    login(client, resident_user)
    create_response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 3},
    )
    assert create_response.status_code == status.HTTP_201_CREATED

    login(client, farmer_user)
    delete_response = client.delete(f"/api/products/{product.public_id}")
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    login(client, resident_user)
    list_response = client.get("/api/interests/me")

    assert list_response.status_code == status.HTTP_200_OK
    interest = list_response.json()["items"][0]
    assert interest["product_public_id"] is None
    assert interest["product_name"] == "Alface"
    assert interest["product_status"] == "Indisponível"


def test_interest_shows_unavailable_when_product_runs_out(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer_user = add_user(session, "farmer@example.com")
    farmer = add_farmer(session, farmer_user)
    product = add_product(session, farmer, name="Alface")
    resident_user = add_user(session, "resident@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)

    login(client, resident_user)
    create_response = client.post(
        "/api/interests",
        json={"product_public_id": str(product.public_id), "quantity": 3},
    )
    assert create_response.status_code == status.HTTP_201_CREATED

    login(client, farmer_user)
    update_response = client.patch(
        f"/api/products/{product.public_id}",
        json={"quantity": 0},
    )
    assert update_response.status_code == status.HTTP_200_OK

    login(client, resident_user)
    list_response = client.get("/api/interests/me")

    assert list_response.status_code == status.HTTP_200_OK
    interest = list_response.json()["items"][0]
    assert interest["product_name"] == "Alface"
    assert interest["product_status"] == "Indisponível"


def test_list_interests_permissions(
    client: TestClient,
    session: Session,
):
    # Anônimo
    response = client.get("/api/interests/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # Agricultor
    farmer_user = add_user(session, "farmer@example.com")
    add_farmer(session, farmer_user)
    login(client, farmer_user)
    response = client.get("/api/interests/me")
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_update_interest_by_owner(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )
    product = add_product(session, farmer, name="Alface")
    interest = Interest(buyer_id=resident.id, product_id=product.id, quantity=2)
    session.add(interest)
    session.commit()
    session.refresh(interest)
    login(client, resident_user)

    response = client.patch(
        f"/api/interests/{interest.public_id}",
        json={"quantity": 7},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["quantity"] == 7
    assert response.json()["public_id"] == str(interest.public_id)


def test_update_interest_rejects_non_owner(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )
    other_user = add_user(session, "other@example.com")
    add_resident(session, building, other_user, link_status=LinkStatus.APROVADO)
    product = add_product(session, farmer, name="Alface")
    interest = Interest(buyer_id=resident.id, product_id=product.id, quantity=2)
    session.add(interest)
    session.commit()
    session.refresh(interest)

    login(client, other_user)
    response = client.patch(
        f"/api/interests/{interest.public_id}",
        json={"quantity": 9},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Você só pode alterar seus interesses" in response.json()["detail"]


def test_update_interest_rejects_unknown(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    resident_user = add_user(session, "resident@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)
    login(client, resident_user)

    response = client.patch(
        f"/api/interests/{UNKNOWN_ID}",
        json={"quantity": 5},
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Interesse não encontrado"


def test_delete_interest_by_owner(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )
    product = add_product(session, farmer, name="Alface")
    interest = Interest(buyer_id=resident.id, product_id=product.id, quantity=2)
    session.add(interest)
    session.commit()
    session.refresh(interest)
    login(client, resident_user)

    response = client.delete(f"/api/interests/{interest.public_id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Confirma que foi removido
    list_response = client.get("/api/interests/me")
    assert list_response.status_code == status.HTTP_200_OK
    assert len(list_response.json()["items"]) == 0


def test_delete_interest_rejects_non_owner(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )
    other_user = add_user(session, "other@example.com")
    add_resident(session, building, other_user, link_status=LinkStatus.APROVADO)
    product = add_product(session, farmer, name="Alface")
    interest = Interest(buyer_id=resident.id, product_id=product.id, quantity=2)
    session.add(interest)
    session.commit()
    session.refresh(interest)

    login(client, other_user)
    response = client.delete(f"/api/interests/{interest.public_id}")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Você só pode excluir seus interesses" in response.json()["detail"]


def test_delete_interest_rejects_unknown(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    resident_user = add_user(session, "resident@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)
    login(client, resident_user)

    response = client.delete(f"/api/interests/{UNKNOWN_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Interesse não encontrado"


def test_apartment_needs_consolidates_and_sorts(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
):
    farmer_user = add_user(session, "farmer@example.com", name="José Silva")
    farmer = add_farmer(session, farmer_user)
    p_lettuce = add_product(session, farmer, name="Alface", quantity=20)
    p_tomato = add_product(session, farmer, name="Tomate", quantity=15)

    res1_user = add_user(session, "res1@example.com")
    res1 = add_resident(session, building, res1_user, link_status=LinkStatus.APROVADO)
    res2_user = add_user(session, "res2@example.com")
    res2 = add_resident(session, building, res2_user, link_status=LinkStatus.APROVADO)

    session.add_all(
        [
            Interest(buyer_id=res1.id, product_id=p_lettuce.id, quantity=3),
            Interest(buyer_id=res2.id, product_id=p_lettuce.id, quantity=7),
            Interest(buyer_id=res1.id, product_id=p_tomato.id, quantity=15),
        ]
    )
    session.commit()

    login(client, manager)

    # Ordenação padrão (decrescente de total_quantity: tomate=15, alface=10)
    response = client.get("/api/apartments/me/needs")
    assert response.status_code == status.HTTP_200_OK
    needs = response.json()["items"]
    assert len(needs) == 2

    assert needs[0]["product"]["name"] == "Tomate"
    assert needs[0]["total_quantity"] == 15
    assert needs[0]["interested_buyers_count"] == 1
    assert needs[0]["product"]["farmer"]["short_name"] == "José S."
    assert needs[0]["product"]["farmer"]["public_id"] == str(farmer.public_id)

    assert needs[1]["product"]["name"] == "Alface"
    assert needs[1]["total_quantity"] == 10
    assert needs[1]["interested_buyers_count"] == 2

    # Invertendo a ordenação (crescente: alface=10, tomate=15)
    asc_response = client.get("/api/apartments/me/needs?descending=false")
    assert asc_response.status_code == status.HTTP_200_OK
    asc_needs = asc_response.json()["items"]
    assert len(asc_needs) == 2
    assert asc_needs[0]["product"]["name"] == "Alface"
    assert asc_needs[1]["product"]["name"] == "Tomate"


def test_apartment_needs_filters_only_approved_residents_of_same_building(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    product = add_product(session, farmer, name="Batata")

    # Morador aprovado do prédio
    approved_user = add_user(session, "approved@example.com")
    approved_res = add_resident(
        session, building, approved_user, link_status=LinkStatus.APROVADO
    )

    # Morador pendente do mesmo prédio (não deve contar)
    pending_user = add_user(session, "pending@example.com")
    pending_res = add_resident(
        session, building, pending_user, link_status=LinkStatus.PENDENTE
    )

    # Morador recusado do mesmo prédio (não deve contar)
    rejected_user = add_user(session, "rejected@example.com")
    rejected_res = add_resident(
        session, building, rejected_user, link_status=LinkStatus.RECUSADO
    )

    # Morador aprovado de outro prédio (não deve contar)
    other_manager = add_user(session, "other_mgr@example.com")
    other_building = add_building(session, other_manager, name="Edifício Outro")
    other_user = add_user(session, "other_res@example.com")
    other_res = add_resident(
        session, other_building, other_user, link_status=LinkStatus.APROVADO
    )

    session.add_all(
        [
            Interest(buyer_id=approved_res.id, product_id=product.id, quantity=5),
            Interest(buyer_id=pending_res.id, product_id=product.id, quantity=20),
            Interest(buyer_id=rejected_res.id, product_id=product.id, quantity=50),
            Interest(buyer_id=other_res.id, product_id=product.id, quantity=100),
        ]
    )
    session.commit()

    login(client, manager)
    response = client.get("/api/apartments/me/needs")

    assert response.status_code == status.HTTP_200_OK
    needs = response.json()["items"]
    assert len(needs) == 1
    assert needs[0]["total_quantity"] == 5
    assert needs[0]["interested_buyers_count"] == 1


def test_apartment_needs_ignores_expired_products(
    client: TestClient,
    session: Session,
    manager: User,
    building: Apartment,
):
    farmer = add_farmer(session, add_user(session, "farmer@example.com"))
    valid_product = add_product(
        session, farmer, name="Válido", expiration_date=_today() + timedelta(days=5)
    )
    expired_product = add_product(
        session, farmer, name="Vencido", expiration_date=_today() - timedelta(days=1)
    )

    resident_user = add_user(session, "resident@example.com")
    resident = add_resident(
        session, building, resident_user, link_status=LinkStatus.APROVADO
    )

    session.add_all(
        [
            Interest(buyer_id=resident.id, product_id=valid_product.id, quantity=4),
            Interest(buyer_id=resident.id, product_id=expired_product.id, quantity=10),
        ]
    )
    session.commit()

    login(client, manager)
    response = client.get("/api/apartments/me/needs")

    assert response.status_code == status.HTTP_200_OK
    needs = response.json()["items"]
    assert len(needs) == 1
    assert needs[0]["product"]["name"] == "Válido"
    assert needs[0]["total_quantity"] == 4


def test_apartment_needs_permissions(
    client: TestClient,
    session: Session,
    building: Apartment,
):
    # Anônimo
    response = client.get("/api/apartments/me/needs")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # Morador (não síndico)
    resident_user = add_user(session, "resident@example.com")
    add_resident(session, building, resident_user, link_status=LinkStatus.APROVADO)
    login(client, resident_user)
    response = client.get("/api/apartments/me/needs")
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "apenas para síndicos" in response.json()["detail"]

    # Agricultor (não síndico)
    farmer_user = add_user(session, "farmer@example.com")
    add_farmer(session, farmer_user)
    login(client, farmer_user)
    response = client.get("/api/apartments/me/needs")
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "apenas para síndicos" in response.json()["detail"]
