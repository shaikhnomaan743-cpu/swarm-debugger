from fastapi.testclient import TestClient


def test_create_session_requires_auth(client: TestClient) -> None:
    response = client.post("/api/sessions", json={"project_name": "x", "use_demo_fixture": True})
    assert response.status_code == 401


def test_create_and_list_demo_session(authed_client: TestClient) -> None:
    created = authed_client.post(
        "/api/sessions",
        json={"project_name": "divide-bug", "use_demo_fixture": True},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["status"] == "created"
    assert body["project_name"] == "divide-bug"
    session_id = body["id"]

    listing = authed_client.get("/api/sessions")
    assert listing.status_code == 200
    assert any(item["id"] == session_id for item in listing.json())

    detail = authed_client.get(f"/api/sessions/{session_id}")
    assert detail.status_code == 200
    files = {item["path"]: item for item in detail.json()["files"]}
    assert "solution.py" in files
    assert files["test_solution.py"]["protected"] is True


def test_rejects_non_python(authed_client: TestClient) -> None:
    response = authed_client.post(
        "/api/sessions",
        json={
            "project_name": "js",
            "language": "javascript",
            "files": [{"path": "index.js", "content": "1"}],
        },
    )
    assert response.status_code == 400


def test_rejects_protected_escape(authed_client: TestClient) -> None:
    response = authed_client.post(
        "/api/sessions",
        json={
            "project_name": "escape",
            "files": [{"path": "../secret.py", "content": "x"}],
        },
    )
    assert response.status_code == 400
