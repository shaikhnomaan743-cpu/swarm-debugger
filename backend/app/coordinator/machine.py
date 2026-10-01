"""Deterministic Coordinator — the debugging state machine.

The Coordinator is NOT an LLM. It owns: session init, baseline gate,
round budget, agent dispatch order, evidence aggregation, duplicate
detection, termination, and human-review escalation.
"""
from __future__ import annotations

PHASES = [
    "BASELINE",
    "LOCALIZE",
    "PROSECUTOR",
    "DEFENDER",
    "EXECUTE",
    "TRACE",
    "JUDGE",
    "DECISION",
]

TERMINAL = {"VERIFIED", "TERMINATED", "HUMAN_REVIEW", "CANCELLED"}

ALLOWED: dict[str, list[str]] = {
    "BASELINE": ["LOCALIZE", "TERMINATED", "HUMAN_REVIEW"],
    "LOCALIZE": ["PROSECUTOR", "TERMINATED"],
    "PROSECUTOR": ["DEFENDER", "TERMINATED"],
    "DEFENDER": ["EXECUTE", "TERMINATED"],
    "EXECUTE": ["TRACE", "TERMINATED"],
    "TRACE": ["JUDGE", "TERMINATED"],
    "JUDGE": ["DECISION", "TERMINATED"],
    "DECISION": ["LOCALIZE", "VERIFIED", "TERMINATED", "HUMAN_REVIEW"],
}


def next_phase(current: str, outcome: str) -> str:
    """Deterministic transition. `outcome` is a Judge/coordinator signal."""
    outcome = (outcome or "").upper()
    if outcome in TERMINAL:
        return outcome
    if current == "BASELINE":
        if outcome == "REPRODUCED":
            return "LOCALIZE"
        if outcome == "NOT_REPRODUCED":
            return "HUMAN_REVIEW"
        return "TERMINATED"
    if current == "DECISION":
        if outcome == "NEXT_ROUND":
            return "LOCALIZE"
        if outcome == "VERIFIED":
            return "VERIFIED"
        if outcome == "HUMAN_REVIEW":
            return "HUMAN_REVIEW"
        return "TERMINATED"
    options = ALLOWED.get(current, [])
    return options[0] if options else "TERMINATED"


def should_start_next_round(*, round_number: int, max_rounds: int, verified: bool,
                             repeated: bool, sandbox_failures: int,
                             max_sandbox_failures: int) -> tuple[bool, str]:
    if verified:
        return False, "verified_fix"
    if repeated:
        return False, "repeated_candidate"
    if sandbox_failures >= max_sandbox_failures:
        return False, "sandbox_failure_threshold"
    if round_number >= max_rounds:
        return False, "max_rounds"
    return True, "continue"
