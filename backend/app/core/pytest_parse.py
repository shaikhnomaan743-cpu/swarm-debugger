from __future__ import annotations

import json
import re
from dataclasses import dataclass


SUMMARY_RE = re.compile(
    r"=+ (?P<body>.+?) in [0-9.]+s =+",
)
COUNT_RE = re.compile(r"(\d+) (passed|failed|error|errors|skipped)")


@dataclass
class TestSummary:
    total: int | None
    passed: int | None
    failed: int | None
    raw: str


def parse_pytest_output(stdout: str, stderr: str) -> TestSummary:
    text = f"{stdout}\n{stderr}"
    match = SUMMARY_RE.search(text)
    body = match.group("body") if match else text
    counts = {"passed": 0, "failed": 0, "error": 0, "skipped": 0}
    found = False
    for amount, label in COUNT_RE.findall(body):
        found = True
        key = "error" if label.startswith("error") else label
        counts[key] = counts.get(key, 0) + int(amount)
    if not found:
        return TestSummary(total=None, passed=None, failed=None, raw=body.strip())
    failed = counts["failed"] + counts["error"]
    passed = counts["passed"]
    total = passed + failed + counts["skipped"]
    return TestSummary(total=total, passed=passed, failed=failed, raw=body.strip())


def dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def loads_list(value: str) -> list:
    try:
        parsed = json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []
