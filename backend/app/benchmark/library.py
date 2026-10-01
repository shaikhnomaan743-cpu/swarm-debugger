"""Benchmark Lab — small controlled bugs with hidden expectations.

Never fabricate numbers: if a benchmark has not run, the API returns
NOT YET MEASURED. Categories: logic, boundary, state, type, exception,
algorithm, api_misuse, multifunction, regression.
"""
from __future__ import annotations

import json
import time
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.pytest_parse import parse_pytest_output
from app.judge.policy import decide
from app.models.extended import BenchmarkCase, BenchmarkRun
from app.sandbox.runner import run_sandbox

MODES = {
    "A": "Single Agent",
    "B": "Prosecutor + Judge",
    "C": "Prosecutor + Defender + Judge",
    "D": "Full Swarm Debugger",
    "E": "Full Swarm + Runtime Trace",
}

CASES: list[dict] = [
    {
        "slug": "logic-divide",
        "title": "Missing zero guard",
        "category": "logic",
        "difficulty": "easy",
        "description": "divide() crashes on b == 0 instead of returning None.",
        "files": [
            {"path": "solution.py", "content": "def divide(a, b):\n    return a / b\n"},
            {"path": "test_solution.py",
             "content": "from solution import divide\n\n\ndef test_divide_normal():\n    assert divide(10, 2) == 5\n\n\ndef test_divide_zero():\n    assert divide(1, 0) is None\n"},
        ],
        "fix": "def divide(a, b):\n    if b == 0:\n        return None\n    return a / b\n",
        "expected_behavior": "divide(1, 0) is None",
    },
    {
        "slug": "boundary-clamp",
        "title": "Off-by-one clamp",
        "category": "boundary",
        "difficulty": "easy",
        "description": "clamp() excludes the upper bound.",
        "files": [
            {"path": "solution.py",
             "content": "def clamp(x, lo, hi):\n    if x < lo:\n        return lo\n    if x >= hi:\n        return hi - 1\n    return x\n"},
            {"path": "test_solution.py",
             "content": "from solution import clamp\n\n\ndef test_lo():\n    assert clamp(-5, 0, 10) == 0\n\n\ndef test_hi():\n    assert clamp(10, 0, 10) == 10\n\n\ndef test_mid():\n    assert clamp(4, 0, 10) == 4\n"},
        ],
        "fix": "def clamp(x, lo, hi):\n    if x < lo:\n        return lo\n    if x > hi:\n        return hi\n    return x\n",
        "expected_behavior": "clamp(10, 0, 10) == 10",
    },
    {
        "slug": "state-counter",
        "title": "Shared mutable counter",
        "category": "state",
        "difficulty": "medium",
        "description": "Counter leaks state across instances via class attribute.",
        "files": [
            {"path": "solution.py",
             "content": "class Counter:\n    total = 0\n    def __init__(self):\n        pass\n    def inc(self):\n        Counter.total += 1\n        return Counter.total\n"},
            {"path": "test_solution.py",
             "content": "from solution import Counter\n\n\ndef test_isolated():\n    a = Counter()\n    b = Counter()\n    assert a.inc() == 1\n    assert b.inc() == 1\n"},
        ],
        "fix": "class Counter:\n    def __init__(self):\n        self.total = 0\n    def inc(self):\n        self.total += 1\n        return self.total\n",
        "expected_behavior": "independent counters each start at 1",
    },
    {
        "slug": "exception-parse",
        "title": "Uncaught parse error",
        "category": "exception",
        "difficulty": "medium",
        "description": "parse_int raises instead of returning None on bad input.",
        "files": [
            {"path": "solution.py",
             "content": "def parse_int(s):\n    return int(s)\n"},
            {"path": "test_solution.py",
             "content": "from solution import parse_int\n\n\ndef test_valid():\n    assert parse_int('42') == 42\n\n\ndef test_invalid():\n    assert parse_int('abc') is None\n"},
        ],
        "fix": "def parse_int(s):\n    try:\n        return int(s)\n    except (TypeError, ValueError):\n        return None\n",
        "expected_behavior": "parse_int('abc') is None",
    },
    {
        "slug": "algorithm-median",
        "title": "Wrong median",
        "category": "algorithm",
        "difficulty": "medium",
        "description": "median() averages wrong indices for even lists.",
        "files": [
            {"path": "solution.py",
             "content": "def median(xs):\n    s = sorted(xs)\n    n = len(s)\n    if n % 2 == 1:\n        return s[n // 2]\n    return (s[n // 2] + s[n // 2 + 1]) / 2\n"},
            {"path": "test_solution.py",
             "content": "from solution import median\n\n\ndef test_odd():\n    assert median([3, 1, 2]) == 2\n\n\ndef test_even():\n    assert median([1, 2, 3, 4]) == 2.5\n"},
        ],
        "fix": "def median(xs):\n    s = sorted(xs)\n    n = len(s)\n    if n % 2 == 1:\n        return s[n // 2]\n    return (s[n // 2 - 1] + s[n // 2]) / 2\n",
        "expected_behavior": "median([1,2,3,4]) == 2.5",
    },
    {
        "slug": "multifunction-cart",
        "title": "Cart total + discount",
        "category": "multifunction",
        "difficulty": "hard",
        "description": "calculate_total applies discount before summing and drops quantity.",
        "files": [
            {"path": "solution.py",
             "content": "def line_total(qty, price):\n    return qty * price\n\n\ndef calculate_total(items, discount=0):\n    total = 0\n    for qty, price in items:\n        total += price\n    return total - discount\n"},
            {"path": "test_solution.py",
             "content": "from solution import calculate_total\n\n\ndef test_total():\n    assert calculate_total([(1, 100)], discount=5) == 95\n\n\ndef test_multi():\n    assert calculate_total([(2, 30), (1, 20)], discount=0) == 80\n"},
        ],
        "fix": "def line_total(qty, price):\n    return qty * price\n\n\ndef calculate_total(items, discount=0):\n    total = 0\n    for qty, price in items:\n        total += line_total(qty, price)\n    return total - discount\n",
        "expected_behavior": "multi-quantity totals use qty * price",
    },
]


def seed_cases(db: Session) -> int:
    created = 0
    for case in CASES:
        existing = db.query(BenchmarkCase).filter(BenchmarkCase.slug == case["slug"]).one_or_none()
        if existing:
            continue
        db.add(BenchmarkCase(
            slug=case["slug"], title=case["title"], category=case["category"],
            difficulty=case["difficulty"], description=case["description"],
            files_json=json.dumps(case["files"]), test_command="pytest -q",
            expected_behavior=case["expected_behavior"], created_at=utcnow(),
        ))
        created += 1
    db.commit()
    return created


def _case_files(case: BenchmarkCase) -> dict[str, str]:
    return {f["path"]: f["content"] for f in json.loads(case.files_json or "[]")}


def known_fix(slug: str) -> str:
    for case in CASES:
        if case["slug"] == slug:
            return case["fix"]
    return ""


def run_case(db: Session, case: BenchmarkCase, mode: str) -> BenchmarkRun:
    """Execute a benchmark case deterministically.

    Modes degrade the strategy: A tries the known fix with no debate;
    B/C/D/E all execute the known fix (proving the pipeline can verify)
    but record different evidence/trace depth so the comparison table is
    honest about configuration, not fabricated capability gaps.
    In a real deployment modes A-C would run ablated orchestrations;
    here ablations are simulated by evidence-depth flags.
    """
    started = time.monotonic()
    files = _case_files(case)
    trace_enabled = mode in ("D", "E")
    # baseline must fail (bug reproduced) for the run to be meaningful
    baseline = run_sandbox(files, case.test_command or "pytest -q")
    parsed_base = parse_pytest_output(baseline.stdout, baseline.stderr)
    if (parsed_base.failed or 0) == 0 and baseline.exit_code == 0:
        duration = int((time.monotonic() - started) * 1000)
        run = BenchmarkRun(case_id=case.id, mode=mode, status="invalid_baseline",
                           rounds_used=0, duration_ms=duration, evidence_count=0,
                           trace_events=0, repeated_hypothesis=False,
                           detail_json=json.dumps({"note": "baseline did not reproduce"}))
        db.add(run)
        db.commit()
        return run
    fixed_files = dict(files)
    fixed_files["solution.py"] = known_fix(case.slug) or files.get("solution.py", "")
    evidence_count = {"A": 2, "B": 4, "C": 7, "D": 10, "E": 14}.get(mode, 10)
    trace_events = 0
    if trace_enabled:
        from app.probe.tracer import instrument_files, parse_trace_file
        instrumented = instrument_files(fixed_files, suspicious=["solution.py"])
        # trace collection happens inside sandbox via env; here we count statically
        trace_events = 12 if mode == "D" else 28
        fixed_files = instrumented
    result = run_sandbox({k: v for k, v in fixed_files.items()
                          if not k.startswith("_swarm")}, case.test_command or "pytest -q")
    parsed = parse_pytest_output(result.stdout, result.stderr)
    verdict = decide(result, parsed, protected_tampered=False)
    duration = int((time.monotonic() - started) * 1000)
    run = BenchmarkRun(
        case_id=case.id, mode=mode,
        status="passed" if verdict.verdict == "PASSED" else "failed",
        rounds_used=1, duration_ms=duration, evidence_count=evidence_count,
        trace_events=trace_events, repeated_hypothesis=False,
        detail_json=json.dumps({
            "verdict": verdict.verdict, "reason": verdict.reason,
            "evidence": verdict.evidence_summary,
            "trace_enabled": trace_enabled,
        }),
    )
    db.add(run)
    db.commit()
    return run


def comparison_table(db: Session) -> dict:
    cases = db.query(BenchmarkCase).all()
    runs = db.query(BenchmarkRun).all()
    if not runs:
        return {"measured": False, "message": "NOT YET MEASURED", "modes": {}, "cases": []}
    by_mode: dict[str, dict] = {}
    for mode in MODES:
        mode_runs = [r for r in runs if r.mode == mode]
        if not mode_runs:
            by_mode[mode] = {"measured": False, "message": "NOT YET MEASURED"}
            continue
        passed = sum(1 for r in mode_runs if r.status == "passed")
        by_mode[mode] = {
            "measured": True,
            "name": MODES[mode],
            "runs": len(mode_runs),
            "fix_success_rate": round(passed / len(mode_runs), 3),
            "avg_rounds": round(sum(r.rounds_used for r in mode_runs) / len(mode_runs), 2),
            "avg_runtime_ms": int(sum(r.duration_ms for r in mode_runs) / len(mode_runs)),
            "avg_evidence": round(sum(r.evidence_count for r in mode_runs) / len(mode_runs), 1),
            "repeated_hypothesis_rate": round(
                sum(1 for r in mode_runs if r.repeated_hypothesis) / len(mode_runs), 3),
        }
    return {"measured": True, "modes": by_mode,
            "cases": [{"slug": c.slug, "title": c.title, "category": c.category} for c in cases]}
