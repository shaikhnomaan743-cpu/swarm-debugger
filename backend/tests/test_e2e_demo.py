from fastapi.testclient import TestClient

from app.core.files import is_protected_path


def test_demo_end_to_end_verifies_prosecutor_patch(authed_client: TestClient) -> None:
    created = authed_client.post(
        "/api/sessions",
        json={"project_name": "demo-divide", "use_demo_fixture": True, "max_rounds": 2},
    )
    assert created.status_code == 200
    session_id = created.json()["id"]

    started = authed_client.post(f"/api/sessions/{session_id}/start-sync")
    assert started.status_code == 200
    detail = started.json()
    assert detail["status"] == "verified"
    assert detail["terminated_reason"] == "verified_fix"
    assert detail["current_round"] >= 1

    baseline = next(item for item in detail["executions"] if item["kind"] == "baseline")
    assert baseline["status"] == "FAILED"

    prosecutor = next(
        candidate
        for round_item in detail["rounds"]
        for candidate in round_item["candidates"]
        if candidate["agent"] == "prosecutor"
    )
    defender = next(
        candidate
        for round_item in detail["rounds"]
        for candidate in round_item["candidates"]
        if candidate["agent"] == "defender"
    )
    assert prosecutor["status"] == "VERIFIED"
    assert defender["status"] in {"FAILED", "REJECTED", "TIMEOUT"}
    assert prosecutor["demo_mode"] is True

    for candidate in (prosecutor, defender):
        for entry in candidate["files"]:
            assert not is_protected_path(entry["path"])

    decisions = [decision for round_item in detail["rounds"] for decision in round_item["decisions"]]
    assert any(decision["verdict"] == "PASSED" for decision in decisions)
    assert any(decision["verdict"] == "FAILED" for decision in decisions)
