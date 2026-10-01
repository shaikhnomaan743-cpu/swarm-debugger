"""Fault Localizer — structured suspicious-region analysis before patch generation."""
from __future__ import annotations

import ast
import re


def _symbols_in_source(source: str) -> list[str]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.append(node.name)
    return names


def localize(files: dict[str, str], *, stdout: str, stderr: str,
             failing_hint: str = "") -> dict:
    text = f"{stdout}\n{stderr}\n{failing_hint}"
    failing_tests: list[str] = sorted(set(re.findall(r"(test_[A-Za-z0-9_]+)", text)))
    # Stack-trace locations: file.py:line
    regions: list[dict] = []
    for match in re.finditer(r'File "([^"]+)", line (\d+), in (\S+)', text):
        regions.append({"file": match.group(1), "line": int(match.group(2)),
                        "symbol": match.group(3)})
    # Traceback last line: ErrorType: message
    error_lines = [ln.strip() for ln in text.splitlines()
                   if re.match(r"\w*(Error|Exception|assert).*", ln.strip())]
    suspicious_files: list[str] = []
    symbols: list[str] = []
    for path, content in files.items():
        if "test" in path:
            continue
        syms = _symbols_in_source(content)
        symbols.extend(syms)
        score = 0
        for r in regions:
            if r["file"].endswith(path) or path in r["file"]:
                score += 3
        for sym in syms:
            if sym and sym in text:
                score += 1
        if score > 0 or not suspicious_files:
            suspicious_files.append(path)
    evidence = []
    if failing_tests:
        evidence.append(f"failing tests: {', '.join(failing_tests)}")
    if regions:
        evidence.append(f"stack frames: {len(regions)}")
    if error_lines:
        evidence.append(error_lines[-1][:200])
    confidence = min(0.9, 0.3 + 0.15 * len(failing_tests) + 0.1 * len(regions))
    return {
        "files": suspicious_files[:5],
        "symbols": sorted(set(symbols))[:20],
        "failing_tests": failing_tests,
        "suspicious_regions": regions[:10],
        "confidence": round(confidence, 2),
        "evidence": evidence,
    }
