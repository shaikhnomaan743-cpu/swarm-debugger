"""Runtime Probe — AST instrumentation capturing structured execution traces.

Only relevant (suspicious) regions are instrumented to bound overhead.
Captures: function entry/exit, exceptions, variable snapshots at
checkpoints, branch-relevant state, timestamps (seq), termination reason.

The instrumented copy runs inside the sandbox; the tracer writes JSONL
to SWARM_TRACE_PATH which the runner reads back after execution.
"""
from __future__ import annotations

import ast
import json

PROBE_PREAMBLE = '''
import json as _swarm_json, os as _swarm_os, time as _swarm_time
_swarm_trace_path = _swarm_os.environ.get("SWARM_TRACE_PATH", "/tmp/swarm_trace.jsonl")
_swarm_seq = [0]
def _swarm_emit(kind, function, file, line, variables=None, note=""):
    try:
        _swarm_seq[0] += 1
        record = {"seq": _swarm_seq[0], "kind": kind, "function": function,
                  "file": file, "line": line, "variables": variables or {},
                  "note": note or ""}
        with open(_swarm_trace_path, "a", encoding="utf-8") as _fh:
            _fh.write(_swarm_json.dumps(record) + "\\n")
    except Exception:
        pass
'''

_MAX_VARS = 8
_MAX_REPR = 120


def _safe_names(var_names: list[str]) -> list[str]:
    out = []
    for name in var_names:
        if name.startswith("_swarm"):
            continue
        if name in {"self", "cls"}:
            continue
        out.append(name)
        if len(out) >= _MAX_VARS:
            break
    return out


class _ProbeTransformer(ast.NodeTransformer):
    def __init__(self, filename: str):
        self.filename = filename

    def visit_FunctionDef(self, node: ast.FunctionDef):  # noqa: N802
        self.generic_visit(node)
        arg_names = [a.arg for a in node.args.args + node.args.kwonlyargs][: _MAX_VARS]
        entry_vars = "{" + ", ".join(
            f'"{n}": repr({n})[:{_MAX_REPR}]' for n in _safe_names(arg_names)) + "}"
        entry = ast.Expr(value=ast.Call(
            func=ast.Name(id="_swarm_emit", ctx=ast.Load()),
            args=[ast.Constant(value="enter"), ast.Constant(value=node.name),
                  ast.Constant(value=self.filename), ast.Constant(value=node.lineno)],
            keywords=[ast.keyword(arg="variables",
                                  value=ast.parse(entry_vars, mode="eval").body if entry_vars != "{}" else ast.Dict(keys=[], values=[])),
                      ast.keyword(arg="note", value=ast.Constant(value="function entry"))],
        ))
        # wrap body in try/except to capture exceptions + exit
        new_body = [entry] + node.body
        if new_body:
            last = new_body[-1]
            exit_call = ast.Expr(value=ast.Call(
                func=ast.Name(id="_swarm_emit", ctx=ast.Load()),
                args=[ast.Constant(value="exit"), ast.Constant(value=node.name),
                      ast.Constant(value=self.filename), ast.Constant(value=node.lineno)],
                keywords=[ast.keyword(arg="note", value=ast.Constant(value="function exit"))],
            ))
            new_body.append(exit_call)
        node.body = [
            ast.Try(
                body=new_body,
                handlers=[ast.ExceptHandler(
                    type=ast.Name(id="Exception", ctx=ast.Load()),
                    name="_swarm_exc",
                    body=[
                        ast.Expr(value=ast.Call(
                            func=ast.Name(id="_swarm_emit", ctx=ast.Load()),
                            args=[ast.Constant(value="exception"),
                                  ast.Constant(value=node.name),
                                  ast.Constant(value=self.filename),
                                  ast.Constant(value=node.lineno)],
                            keywords=[
                                ast.keyword(arg="variables", value=ast.Dict(keys=[], values=[])),
                                ast.keyword(arg="note", value=ast.Call(
                                    func=ast.Name(id="repr", ctx=ast.Load()),
                                    args=[ast.Name(id="_swarm_exc", ctx=ast.Load())],
                                    keywords=[]))],
                        )),
                        ast.Raise(),
                    ],
                )],
                orelse=[], finalbody=[],
            )
        ]
        return node

    visit_AsyncFunctionDef = visit_FunctionDef  # type: ignore


def instrument_source(source: str, filename: str) -> str:
    """Return instrumented source. Falls back to original on parse failure."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    transformer = _ProbeTransformer(filename)
    tree = transformer.visit(tree)
    ast.fix_missing_locations(tree)
    try:
        instrumented = ast.unparse(tree)
    except Exception:
        return source
    return PROBE_PREAMBLE + "\n" + instrumented


def instrument_files(files: dict[str, str], suspicious: list[str] | None = None) -> dict[str, str]:
    out: dict[str, str] = {}
    targets = set(suspicious or [])
    for path, content in files.items():
        if not path.endswith(".py"):
            out[path] = content
            continue
        if "test" in path:
            out[path] = content
            continue
        if targets and path not in targets and not any(path.endswith(t) or t in path for t in targets):
            # instrument only suspicious regions; but always instrument entry point lightly
            if path not in ("solution.py", "main.py"):
                out[path] = content
                continue
        out[path] = instrument_source(content, path)
    return out


def parse_trace_file(text: str, limit: int = 500) -> list[dict]:
    events: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            events.append(record)
        if len(events) >= limit:
            break
    return events


def summarize_trace(events: list[dict]) -> str:
    if not events:
        return "no trace events captured"
    kinds: dict[str, int] = {}
    funcs: list[str] = []
    for ev in events:
        kinds[str(ev.get("kind"))] = kinds.get(str(ev.get("kind")), 0) + 1
        fn = str(ev.get("function") or "")
        if fn and fn not in funcs:
            funcs.append(fn)
    exc = [e for e in events if e.get("kind") == "exception"]
    tail = f"; exceptions={[str(e.get('note'))[:80] for e in exc]}" if exc else ""
    return f"{len(events)} events kinds={kinds} functions={funcs[:6]}{tail}"
