"""Round-loop safety: custom files, tamper rejection, evidence retention."""

from fastapi.testclient import TestClient

from app.services.orchestrator import _apply_candidate

BROKEN = "def divide(a, b):\n    return a / b\n"
TESTS = (
    "from solution import divide\n\n\n"
    "def test_divide_normal():\n"
    "    assert divide(10, 2) == 5\n\n\n"
    "def test_divide_zero():\n"
    "    assert divide(1, 0) is None\n"
)


def _create_custom(authed_client: TestClient) -> str:
    created = authed_client.post(
        "/api/sessions",
        json={
            "project_name": "custom-divide",
            "language": "python",
            "description": "custom paste flow",
            "test_command": "pytest -q",
            "entry_point": "solution.py",
            "files": [
                {"path": "solution.py", "content": BROKEN},
                {"path": "test_solution.py", "content": TESTS},
            ],
            "max_rounds": 2,
        },
    )
    assert created.status_code == 200, created.text
    return created.json()["id"]


def test_custom_files_session_runs_full_loop(authed_client: TestClient) -> None:
    session_id = _create_custom(authed_client)
    started = authed_client.post(f"/api/sessions/{session_id}/start-sync")
    assert started.status_code == 200, started.text
    detail = started.json()
    # Demo provider knows this fixture shape and must verify the prosecutor fix.
    assert detail["status"] == "verified"
    baseline = next(item for item in detail["executions"] if item["kind"] == "baseline")
    assert baseline["status"] == "FAILED"
    # Rejected defender candidate is retained as evidence, not dropped.
    statuses = [
        candidate["status"]
        for round_item in detail["rounds"]
        for candidate in round_item["candidates"]
    ]
    assert "VERIFIED" in statuses
    assert any(status in {"FAILED", "REJECTED", "TIMEOUT"} for status in statuses)


def test_requires_protected_test_file(authed_client: TestClient) -> None:
    response = authed_client.post(
        "/api/sessions",
        json={
            "project_name": "no-tests",
            "files": [{"path": "solution.py", "content": BROKEN}],
        },
    )
    assert response.status_code == 400


def test_apply_candidate_blocks_protected_paths() -> None:
    base = {"solution.py": BROKEN, "test_solution.py": TESTS}
    merged, tampered = _apply_candidate(
        base,
        [
            {"path": "solution.py", "content": "def divide(a, b):\n    return 1\n"},
            {"path": "test_solution.py", "content": "def test_x():\n    assert True\n"},
        ],
    )
    assert tampered is True
    # Protected test content is never overwritten by a candidate.
    assert merged["test_solution.py"] == TESTS
    assert merged["solution.py"] == "def divide(a, b):\n    return 1\n"


def test_cancel_then_delete_round_trip(authed_client: TestClient) -> None:
    session_id = _create_custom(authed_client)
    cancelled = authed_client.post(f"/api/sessions/{session_id}/cancel")
    assert cancelled.status_code == 200
    deleted = authed_client.delete(f"/api/sessions/{session_id}")
    assert deleted.status_code == 200
