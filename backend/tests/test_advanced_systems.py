"""Advanced subsystem tests: coordinator, fault localizer, probe, judge,
memory, tools, evidence, benchmark seed. All deterministic, no network."""
from app.causal.graph import build_round_chain
from app.coordinator.machine import next_phase, should_start_next_round
from app.evidence.engine import EVIDENCE_TYPES, diff_text
from app.judge.policy import build_falsification_file, compare_candidates, decide_advanced
from app.core.pytest_parse import parse_pytest_output
from app.localizer.fault import localize
from app.memory.rejected import hypothesis_fingerprint
from app.probe.tracer import instrument_files, instrument_source, parse_trace_file
from app.schemas.internal import SandboxResult
from app.tools import registry as tools


def test_coordinator_transitions():
    assert next_phase("BASELINE", "REPRODUCED") == "LOCALIZE"
    assert next_phase("BASELINE", "NOT_REPRODUCED") == "HUMAN_REVIEW"
    assert next_phase("DECISION", "NEXT_ROUND") == "LOCALIZE"
    assert next_phase("DECISION", "VERIFIED") == "VERIFIED"


def test_coordinator_round_budget():
    cont, reason = should_start_next_round(round_number=5, max_rounds=5, verified=False,
                                           repeated=False, sandbox_failures=0,
                                           max_sandbox_failures=3)
    assert cont is False and reason == "max_rounds"
    cont, _ = should_start_next_round(round_number=1, max_rounds=5, verified=False,
                                      repeated=False, sandbox_failures=0,
                                      max_sandbox_failures=3)
    assert cont is True


def test_fault_localizer_finds_stack_region():
    files = {"solution.py": "def divide(a, b):\n    return a / b\n"}
    stdout = ""
    stderr = 'File "solution.py", line 2, in divide\nZeroDivisionError: division by zero\nFAILED test_divide_zero'
    fm = localize(files, stdout=stdout, stderr=stderr)
    assert "solution.py" in fm["files"]
    assert "test_divide_zero" in fm["failing_tests"]
    assert fm["confidence"] > 0
    assert fm["evidence"]


def test_probe_instruments_and_parses():
    src = "def divide(a, b):\n    return a / b\n"
    out = instrument_source(src, "solution.py")
    assert "_swarm_emit" in out
    trace = '{"seq": 1, "kind": "enter", "function": "divide", "file": "solution.py", "line": 1, "variables": {}, "note": ""}\n'
    events = parse_trace_file(trace)
    assert events[0]["function"] == "divide"
    files = instrument_files({"solution.py": src, "test_solution.py": "x"}, suspicious=["solution.py"])
    assert "_swarm_emit" in files["solution.py"]
    assert "_swarm_emit" not in files["test_solution.py"]


def test_judge_advanced_rejects_tamper_and_regression():
    result = SandboxResult(exit_code=0, stdout="1 passed", stderr="", duration_ms=10,
                           timed_out=False, backend="process")
    tests = parse_pytest_output("1 passed in 0.01s", "")
    v = decide_advanced(result, tests, protected_tampered=True)
    assert v.verdict == "REJECTED"
    v2 = decide_advanced(result, tests, protected_tampered=False, baseline_passed=5)
    assert v2.verdict == "FAILED"  # regression


def test_judge_falsification_blocks_bad_patch():
    result = SandboxResult(exit_code=0, stdout="2 passed in 0.01s", stderr="",
                           duration_ms=10, timed_out=False, backend="process")
    tests = parse_pytest_output("2 passed in 0.01s", "")
    v = decide_advanced(result, tests, protected_tampered=False, baseline_passed=0,
                        falsification={"executed": True, "failed": True,
                                       "failed_names": ["test_falsify_1"]})
    assert v.verdict == "FAILED"


def test_falsification_builder_skips_prose():
    content, names = build_falsification_file(
        ["Assert divide(1, 0) is None — this should fail if exception semantics are required."])
    assert names == ["test_falsify_1"]
    assert "assert divide(1, 0) is None" in content
    assert "should fail" not in content
    # pure prose yields no executable test (never fails a patch)
    content2, names2 = build_falsification_file(["think harder about contracts"])
    assert names2 == []


def test_compare_candidates_picks_winner():
    a = {"tests_failed": 0, "regressed": False, "falsification_failed": False,
         "diff_size": 50, "files_changed": ["solution.py"], "duration_ms": 100}
    b = {"tests_failed": 0, "regressed": False, "falsification_failed": False,
         "diff_size": 200, "files_changed": ["solution.py", "extra.py"], "duration_ms": 120}
    res = compare_candidates(a, b)
    assert res["winner"] == "A"


def test_memory_fingerprint_stable():
    assert hypothesis_fingerprint("Missing None guard!", "abc") == \
        hypothesis_fingerprint("missing  none   guard", "abc")


def test_tools_log_nothing_without_db():
    files = {"solution.py": "def divide(a, b):\n    return a / b\n"}
    assert tools.search_code(files, "divide")["count"] >= 1
    assert tools.find_symbol(files, "divide")["locations"]
    assert tools.list_files(files)["files"] == ["solution.py"]
    assert "solution.py" in tools.inspect_diff(files, files)["diff"] or \
        tools.inspect_diff(files, files)["files_changed"] == []


def test_evidence_types_cover_required():
    for t in ["TEST_RESULT", "RUNTIME_TRACE", "FALSIFICATION_RESULT", "FAULT_LOCATION",
              "HYPOTHESIS", "COUNTER_ARGUMENT", "DIFF", "BASELINE_RESULT"]:
        assert t in EVIDENCE_TYPES
    assert "no changes" in diff_text({"a": "1"}, {"a": "1"})
