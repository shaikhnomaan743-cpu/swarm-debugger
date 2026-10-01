from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "swarm-debugger"


def test_root_phase(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["phase"] == "mvp"
