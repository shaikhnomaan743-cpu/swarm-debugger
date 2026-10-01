import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SANDBOX_BACKEND"] = "process"
os.environ["LLM_API_KEY"] = ""
os.environ["MAX_DEBUG_ROUNDS"] = "5"

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def authed_client(client: TestClient) -> TestClient:
    response = client.post(
        "/api/auth/login",
        json={"identifier": settings.demo_username, "password": settings.demo_password},
    )
    assert response.status_code == 200
    return client
