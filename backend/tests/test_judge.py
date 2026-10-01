from app.core.pytest_parse import parse_pytest_output
from app.judge.policy import decide
from app.schemas.internal import SandboxResult


def _result(**kwargs) -> SandboxResult:
    defaults = dict(
        exit_code=0,
        stdout="",
        stderr="",
        duration_ms=10,
        timed_out=False,
        backend="process",
        error=None,
    )
    defaults.update(kwargs)
    return SandboxResult(**defaults)


def test_protected_files_override_passing_tests() -> None:
    stdout = "===== 2 passed in 0.01s ====="
    tests = parse_pytest_output(stdout, "")
    verdict = decide(_result(stdout=stdout), tests, protected_tampered=True)
    assert verdict.verdict == "REJECTED"


def test_timeout_is_not_a_pass() -> None:
    tests = parse_pytest_output("", "")
    verdict = decide(_result(timed_out=True, exit_code=-1), tests, protected_tampered=False)
    assert verdict.verdict == "TIMEOUT"


def test_failing_tests_cannot_be_overridden() -> None:
    stdout = "===== 1 failed, 1 passed in 0.04s ====="
    tests = parse_pytest_output(stdout, "")
    verdict = decide(_result(exit_code=1, stdout=stdout), tests, protected_tampered=False)
    assert verdict.verdict == "FAILED"


def test_passing_suite_is_accepted() -> None:
    stdout = "===== 2 passed in 0.03s ====="
    tests = parse_pytest_output(stdout, "")
    verdict = decide(_result(stdout=stdout), tests, protected_tampered=False)
    assert verdict.verdict == "PASSED"


def test_missing_test_summary_fails() -> None:
    tests = parse_pytest_output("no pytest summary here", "")
    verdict = decide(_result(), tests, protected_tampered=False)
    assert verdict.verdict == "FAILED"
