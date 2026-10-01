"""Controlled agent tools — no unrestricted shell. Every call is logged."""
from __future__ import annotations

import difflib
import json
import re
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.extended import ToolCall

TOOLS = [
    "search_code", "read_file", "find_symbol", "inspect_diff",
    "run_targeted_test", "inspect_trace", "inspect_test_failure",
    "list_files", "get_function_context",
]


def _log(db: Session | None, *, session_id: str, round_id: str | None,
         agent: str, tool: str, payload: dict, result: dict) -> None:
    if db is None:
        return
    try:
        db.add(ToolCall(
            session_id=session_id, round_id=round_id, agent=agent, tool=tool,
            input_json=json.dumps(payload)[:8000],
            result_json=json.dumps(result)[:8000], created_at=utcnow(),
        ))
        db.flush()
    except Exception:
        pass


def search_code(files: dict[str, str], pattern: str, *, db=None,
                session_id="", round_id=None, agent="") -> dict:
    hits = []
    try:
        rx = re.compile(pattern)
    except re.error:
        rx = re.compile(re.escape(pattern))
    for path, content in files.items():
        for i, line in enumerate(content.splitlines(), 1):
            if rx.search(line):
                hits.append({"file": path, "line": i, "text": line.strip()[:200]})
                if len(hits) >= 30:
                    break
    result = {"hits": hits, "count": len(hits)}
    _log(db, session_id=session_id, round_id=round_id, agent=agent,
         tool="search_code", payload={"pattern": pattern}, result={"count": len(hits)})
    return result


def read_file(files: dict[str, str], path: str, *, db=None,
              session_id="", round_id=None, agent="") -> dict:
    content = files.get(path, "")
    result = {"path": path, "found": path in files, "content": content[:8000]}
    _log(db, session_id=session_id, round_id=round_id, agent=agent,
         tool="read_file", payload={"path": path}, result={"found": result["found"]})
    return result


def find_symbol(files: dict[str, str], symbol: str, *, db=None,
                session_id="", round_id=None, agent="") -> dict:
    locations = []
    for path, content in files.items():
        for i, line in enumerate(content.splitlines(), 1):
            if re.search(rf"\b{re.escape(symbol)}\b", line):
                locations.append({"file": path, "line": i, "text": line.strip()[:200]})
                if len(locations) >= 20:
                    break
    result = {"symbol": symbol, "locations": locations}
    _log(db, session_id=session_id, round_id=round_id, agent=agent,
         tool="find_symbol", payload={"symbol": symbol}, result={"count": len(locations)})
    return result


def inspect_diff(before: dict[str, str], after: dict[str, str], *, db=None,
                 session_id="", round_id=None, agent="") -> dict:
    chunks: list[str] = []
    files_changed = []
    for path in sorted(set(before) | set(after)):
        if before.get(path) != after.get(path):
            files_changed.append(path)
            old = before.get(path, "").splitlines()
            new = after.get(path, "").splitlines()
            chunks.extend(difflib.unified_diff(old, new, fromfile=f"a/{path}",
                                               tofile=f"b/{path}", lineterm="", n=3))
    result = {"files_changed": files_changed, "diff": "\n".join(chunks)[:8000]}
    _log(db, session_id=session_id, round_id=round_id, agent=agent,
         tool="inspect_diff", payload={"files": files_changed}, result={"files": files_changed})
    return result


def list_files(files: dict[str, str], *, db=None, session_id="",
               round_id=None, agent="") -> dict:
    result = {"files": sorted(files.keys())}
    _log(db, session_id=session_id, round_id=round_id, agent=agent,
         tool="list_files", payload={}, result={"count": len(files)})
    return result


def get_function_context(files: dict[str, str], symbol: str, *, db=None,
                         session_id="", round_id=None, agent="",
                         window: int = 30) -> dict:
    import ast as _ast
    for path, content in files.items():
        try:
            tree = _ast.parse(content)
        except SyntaxError:
            continue
        for node in _ast.walk(tree):
            if isinstance(node, (_ast.FunctionDef, _ast.AsyncFunctionDef)) and node.name == symbol:
                lines = content.splitlines()
                start = max(0, node.lineno - 1 - 2)
                end = min(len(lines), (node.end_lineno or node.lineno) + 2)
                snippet = "\n".join(lines[start:end])[:6000]
                result = {"file": path, "symbol": symbol, "snippet": snippet}
                _log(db, session_id=session_id, round_id=round_id, agent=agent,
                     tool="get_function_context", payload={"symbol": symbol}, result={"file": path})
                return result
    result = {"file": "", "symbol": symbol, "snippet": ""}
    _log(db, session_id=session_id, round_id=round_id, agent=agent,
         tool="get_function_context", payload={"symbol": symbol}, result={"file": ""})
    return result
