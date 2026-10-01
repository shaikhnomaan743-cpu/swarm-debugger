import posixpath
import re

PROTECTED_NAME_RE = re.compile(
    r"(^|/)(conftest\.py|pytest\.ini|pyproject\.toml|setup\.cfg|\.env.*|secrets?.*)$",
    re.IGNORECASE,
)
TEST_NAME_RE = re.compile(r"(^|/)(tests?/|.*/)?(test_.*\.py|.*_test\.py)$")


def normalize_path(path: str) -> str:
    cleaned = path.replace("\\", "/").strip().lstrip("/")
    normalized = posixpath.normpath(cleaned)
    if normalized.startswith("..") or "/../" in f"/{normalized}/":
        raise ValueError("Path escapes the project workspace")
    if normalized in {"", ".", ".."}:
        raise ValueError("Invalid path")
    return normalized


def is_protected_path(path: str) -> bool:
    normalized = normalize_path(path)
    if PROTECTED_NAME_RE.search(normalized):
        return True
    if TEST_NAME_RE.search(normalized):
        return True
    return False


def classify_file(path: str) -> str:
    if is_protected_path(path):
        if TEST_NAME_RE.search(normalize_path(path)):
            return "test"
        return "config"
    return "source"
