"""Deterministic Judge policy. LLM text may explain; it can never override tests."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.core.pytest_parse import TestSummary
from app.schemas.internal import SandboxResult


@dataclass
class JudgeVerdict:
    verdict: str
    reason: str
    evidence_summary: str
    falsification: dict = field(default_factory=dict)
    regression: dict = field(default_factory=dict)


def decide(
    result: SandboxResult,
    tests: TestSummary,
    *,
    protected_tampered: bool,
    required_tests_expected: bool = True,
) -> JudgeVerdict:
    if protected_tampered:
        return JudgeVerdict(
            verdict="REJECTED",
            reason="Candidate attempted to modify protected tests or configuration.",
            evidence_summary="Protected-file integrity check failed. Runtime results are ignored.",
        )
    if result.error:
        return JudgeVerdict(
            verdict="SANDBOX_ERROR",
            reason=result.error,
            evidence_summary=f"Sandbox backend={result.backend} error={result.error}",
        )
    if result.timed_out:
        return JudgeVerdict(
            verdict="TIMEOUT",
            reason="Execution exceeded the configured timeout.",
            evidence_summary=f"Timed out after {result.duration_ms}ms (backend={result.backend}).",
        )
    passed = tests.passed
    failed = tests.failed
    total = tests.total
    evidence = (
        f"exit_code={result.exit_code} duration_ms={result.duration_ms} "
        f"tests_total={total} tests_passed={passed} tests_failed={failed} "
        f"backend={result.backend}"
    )
    if required_tests_expected and (total is None or total == 0):
        return JudgeVerdict(
            verdict="FAILED",
            reason="Required tests did not execute or could not be parsed from pytest output.",
            evidence_summary=evidence,
        )
    if failed and failed > 0:
        return JudgeVerdict(
            verdict="FAILED",
            reason="One or more required tests failed.",
            evidence_summary=evidence,
        )
    if result.exit_code != 0:
        return JudgeVerdict(
            verdict="FAILED",
            reason="Process exited non-zero even though a passing summary was not confirmed.",
            evidence_summary=evidence,
        )
    if passed is None or passed <= 0:
        return JudgeVerdict(
            verdict="FAILED",
            reason="No passing tests were recorded.",
            evidence_summary=evidence,
        )
    return JudgeVerdict(
        verdict="PASSED",
        reason="All recorded tests passed and protected files were unchanged.",
        evidence_summary=evidence,
    )


def decide_advanced(
    result: SandboxResult,
    tests: TestSummary,
    *,
    protected_tampered: bool,
    baseline_passed: int = 0,
    falsification: dict | None = None,
    unexpected_files: list[str] | None = None,
) -> JudgeVerdict:
    """Full deterministic checklist: build, exit, protected, baseline,
    regression, falsification, runtime/sandbox errors, timeout, resources,
    unexpected file modifications."""
    base = decide(result, tests, protected_tampered=protected_tampered)
    if base.verdict != "PASSED":
        return base
    # 11. unexpected file modifications (outside allowlist of source files)
    if unexpected_files:
        return JudgeVerdict(
            verdict="REJECTED",
            reason=f"Candidate modified unexpected files: {', '.join(unexpected_files[:5])}.",
            evidence_summary=base.evidence_summary + " unexpected_modifications=1",
        )
    # resource violations surfaced via error text
    blob = f"{result.stdout}\n{result.stderr}".lower()
    if "memoryerror" in blob or "out of memory" in blob:
        return JudgeVerdict(
            verdict="REJECTED",
            reason="Candidate exceeded memory limits during execution.",
            evidence_summary=base.evidence_summary + " resource_violation=memory",
        )
    # regression: candidate must not pass fewer tests than baseline did
    passed = tests.passed or 0
    regression = {"baseline_passed": baseline_passed, "candidate_passed": passed,
                  "regressed": passed < baseline_passed}
    if passed < baseline_passed:
        return JudgeVerdict(
            verdict="FAILED",
            reason=f"Regression: candidate passes {passed} tests vs baseline {baseline_passed}.",
            evidence_summary=base.evidence_summary + f" regression=1",
            regression=regression,
        )
    # falsification: executable counter-tests from the Defender
    falsification = falsification or {}
    if falsification.get("executed") and falsification.get("failed"):
        return JudgeVerdict(
            verdict="FAILED",
            reason=f"Falsification test failed: {falsification.get('failed_names', ['?'])[0]}.",
            evidence_summary=base.evidence_summary + " falsification_failed=1",
            falsification=falsification,
            regression=regression,
        )
    return JudgeVerdict(
        verdict="PASSED",
        reason="All checks passed: build, exit code, protected tests, "
               "baseline, regression, falsification, runtime, sandbox, timeout, resources.",
        evidence_summary=base.evidence_summary + " falsification_ok=1 regression_ok=1",
        falsification=falsification or {},
        regression=regression,
    )


def _clean_falsification_code(code: str) -> str:
    code = code.strip().rstrip(".")
    # strip trailing natural-language explanations after dashes/arrows
    for sep in [" — ", " – ", " -- ", " - ", " should ", " this ", " if ", " because ", " since "]:
        if sep in code:
            head, tail = code.split(sep, 1)
            # keep head only if it looks like code (has parens or operators)
            if re.search(r"[\(\)=<>!]", head):
                code = head.strip()
    # keep only the first statement line
    code = code.splitlines()[0].strip()
    # trailing commentary after comma outside parens is unlikely code; keep as-is if parseable
    return code


def build_falsification_file(falsification_tests: list[str]) -> tuple[str, list[str]]:
    """Turn Defender falsification strings into an executable pytest module.

    Extracts code spans / assert-like expressions. Returns (file_content, names).
    Non-extractable or unparseable lines are skipped (recorded, never counted
    as failure) so a poorly worded falsification can never fail a good patch.
    """
    import ast as _ast

    names: list[str] = []
    body: list[str] = []
    body.append("from solution import *  # noqa")
    idx = 0
    for raw in falsification_tests:
        line = (raw or "").strip()
        if not line:
            continue
        # extract backticked code or the whole line after 'Assert'
        code = None
        m = re.search(r"`([^`]+)`", line)
        if m:
            code = m.group(1)
        else:
            m2 = re.search(r"[Aa]ssert\s+(.+)", line)
            if m2:
                code = m2.group(1).strip().rstrip(".")
        if not code:
            continue
        code = _clean_falsification_code(code)
        if code.startswith("assert "):
            stmt = code
        else:
            stmt = f"assert {code}"
        # validate syntax — never let a malformed falsification fail a patch
        try:
            _ast.parse(stmt)
        except SyntaxError:
            continue
        idx += 1
        name = f"test_falsify_{idx}"
        names.append(name)
        body.append(f"\ndef {name}():\n    {stmt}\n")
    content = "\n".join(body) + "\n" if names else ""
    return content, names


def compare_candidates(a: dict, b: dict) -> dict:
    """Explicit winner selection when both candidates pass. Never mark both verified.

    Dimensions: required tests, regressions, falsification, scope (files/diff),
    protected integrity, runtime anomalies.
    """
    def score(c: dict) -> tuple:
        # lower is better: (failed, regressions, fals_failed, diff_size, files, duration, anomalies)
        return (
            c.get("tests_failed") or 0,
            1 if c.get("regressed") else 0,
            1 if c.get("falsification_failed") else 0,
            c.get("diff_size") or 0,
            len(c.get("files_changed") or []),
            c.get("duration_ms") or 0,
            1 if c.get("anomaly") else 0,
        )
    sa, sb = score(a), score(b)
    if sa == sb:
        # tie-break: prosecutor (A) wins only if strictly identical on evidence;
        # prefer smaller patch — already in score. Final tie-break: A.
        winner = "A"
        reason = "Both candidates pass all evidence checks; winner selected by minimal scope tie-break."
    elif sa < sb:
        winner = "A"
        reason = (f"Candidate A wins: failed={sa[0]}vs{sb[0]}, regression={sa[1]}vs{sb[1]}, "
                  f"falsification={sa[2]}vs{sb[2]}, diff={sa[3]}vs{sb[3]}, files={sa[4]}vs{sb[4]}.")
    else:
        winner = "B"
        reason = (f"Candidate B wins: failed={sb[0]}vs{sa[0]}, regression={sb[1]}vs{sa[1]}, "
                  f"falsification={sb[2]}vs{sa[2]}, diff={sb[3]}vs{sa[3]}, files={sb[4]}vs{sa[4]}.")
    return {"winner": winner, "reason": reason, "score_a": list(sa), "score_b": list(sb)}


def session_outcome(verdicts: list[JudgeVerdict]) -> str:
    if any(item.verdict == "PASSED" for item in verdicts):
        return "VERIFIED"
    if all(item.verdict == "SANDBOX_ERROR" for item in verdicts) and verdicts:
        return "SANDBOX_ERROR"
    return "FAILED"
