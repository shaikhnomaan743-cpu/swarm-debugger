from app.core.files import is_protected_path, normalize_path


def test_test_files_are_protected() -> None:
    assert is_protected_path("test_solution.py")
    assert is_protected_path("tests/test_api.py")
    assert is_protected_path("pytest.ini")
    assert not is_protected_path("solution.py")


def test_normalize_rejects_escape() -> None:
    try:
        normalize_path("../etc/passwd")
        raise AssertionError("expected failure")
    except ValueError:
        pass
