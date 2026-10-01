from fastapi.testclient import TestClient

from app.core.config import settings


def test_login_rejects_empty_payload(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"identifier": "   ", "password": "x"})
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "VALIDATION_ERROR"


def test_login_rejects_bad_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"identifier": settings.demo_email, "password": "wrong"},
    )
    assert response.status_code == 401
    assert response.json()["detail"]["error"] == "AUTH_ERROR"


def test_me_requires_session(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"]["error"] == "AUTH_ERROR"


def test_login_me_logout_flow(client: TestClient) -> None:
    login = client.post(
        "/api/auth/login",
        json={"identifier": settings.demo_username, "password": settings.demo_password},
    )
    assert login.status_code == 200
    body = login.json()
    assert body["email"] == settings.demo_email
    assert body["username"] == settings.demo_username
    assert settings.session_cookie_name in login.cookies

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == settings.demo_email

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200

    after = client.get("/api/auth/me")
    assert after.status_code == 401


def test_login_accepts_email(client: TestClient) -> None:
    login = client.post(
        "/api/auth/login",
        json={"identifier": settings.demo_email, "password": settings.demo_password},
    )
    assert login.status_code == 200
    assert login.json()["username"] == settings.demo_username


def test_login_accepts_username_case_insensitive(client: TestClient) -> None:
    login = client.post(
        "/api/auth/login",
        json={"identifier": settings.demo_username.upper(), "password": settings.demo_password},
    )
    assert login.status_code == 200
    assert login.json()["email"] == settings.demo_email
