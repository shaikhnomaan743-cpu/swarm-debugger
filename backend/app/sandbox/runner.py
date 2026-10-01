from __future__ import annotations

import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

from app.core.config import settings
from app.core.files import normalize_path
from app.schemas.internal import SandboxResult

_QUEUE_LOCK = threading.Lock()
_QUEUE_DEPTH = 0

ALLOWED_BINARIES = {"pytest"}


def queue_depth() -> int:
    with _QUEUE_LOCK:
        return _QUEUE_DEPTH


def _enter_queue() -> None:
    global _QUEUE_DEPTH
    with _QUEUE_LOCK:
        _QUEUE_DEPTH += 1


def _leave_queue() -> None:
    global _QUEUE_DEPTH
    with _QUEUE_LOCK:
        _QUEUE_DEPTH = max(0, _QUEUE_DEPTH - 1)


def docker_available() -> bool:
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            timeout=8,
            check=False,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def resolve_backend() -> str:
    requested = (settings.sandbox_backend or "auto").strip().lower()
    if requested == "docker":
        return "docker"
    if requested == "process":
        return "process"
    return "docker" if docker_available() else "process"


def parse_test_command(command: str) -> list[str]:
    parts = shlex.split(command or "pytest -q")
    if not parts:
        raise ValueError("Test command is empty")
    binary = Path(parts[0]).name
    if binary not in ALLOWED_BINARIES:
        raise ValueError("Only pytest is allowed as the test command in the MVP")
    return parts


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    omitted = len(text) - limit
    return text[:limit] + f"\n...[truncated {omitted} bytes]"


def _write_workspace(root: Path, files: dict[str, str]) -> None:
    for raw_path, content in files.items():
        rel = normalize_path(raw_path)
        dest = root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")


def _ensure_sandbox_image() -> str | None:
    image = settings.sandbox_image
    inspect = subprocess.run(["docker", "image", "inspect", image], capture_output=True, check=False)
    if inspect.returncode == 0:
        return image
    docker_dir = Path(__file__).resolve().parents[3] / "sandbox" / "docker"
    if not docker_dir.exists():
        return None
    build = subprocess.run(
        ["docker", "build", "-t", image, str(docker_dir)],
        capture_output=True,
        text=True,
        check=False,
    )
    if build.returncode != 0:
        return None
    return image


def _run_docker(files: dict[str, str], command: list[str], timeout: int,
              *, collect_trace: bool = False) -> SandboxResult:
    image = _ensure_sandbox_image()
    if not image:
        return SandboxResult(
            exit_code=-1,
            stdout="",
            stderr="Sandbox image is unavailable",
            duration_ms=0,
            timed_out=False,
            backend="docker",
            error="Sandbox image build failed",
        )
    with tempfile.TemporaryDirectory(prefix="swarm-sandbox-") as tmp:
        work = Path(tmp)
        _write_workspace(work, files)
        trace_path = work / "swarm_trace.jsonl"
        docker_cmd = [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--memory",
            f"{settings.sandbox_memory_mb}m",
            "--memory-swap",
            f"{settings.sandbox_memory_mb}m",
            "--cpus",
            str(settings.sandbox_cpu_limit),
            "--pids-limit",
            str(settings.sandbox_pids_limit),
            "--read-only",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            "--security-opt",
            "no-new-privileges",
            "--cap-drop",
            "ALL",
            "--user",
            "10001:10001",
            "-v",
            f"{work}:/work:rw",
            "-w",
            "/work",
            "-e",
            f"SWARM_TRACE_PATH={'/work/swarm_trace.jsonl' if collect_trace else '/tmp/swarm_trace.jsonl'}",
            image,
            *command,
        ]
        started = time.monotonic()
        try:
            completed = subprocess.run(
                docker_cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 3,
                check=False,
                env={"PATH": os.environ.get("PATH", "/usr/bin:/bin")},
            )
        except subprocess.TimeoutExpired as exc:
            duration = int((time.monotonic() - started) * 1000)
            stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
            stderr = exc.stderr.decode() if isinstance(exc.stderr, bytes) else (exc.stderr or "")
            return SandboxResult(
                exit_code=-1,
                stdout=_truncate(stdout, settings.sandbox_output_limit_bytes),
                stderr=_truncate(stderr, settings.sandbox_output_limit_bytes),
                duration_ms=duration,
                timed_out=True,
                backend="docker",
            )
        duration = int((time.monotonic() - started) * 1000)
        extra: dict[str, str] = {}
        if collect_trace:
            try:
                host_trace = work / "swarm_trace.jsonl"
                if host_trace.exists():
                    extra["trace"] = _truncate(
                        host_trace.read_text(encoding="utf-8", errors="replace"),
                        settings.sandbox_output_limit_bytes)
            except OSError:
                pass
        return SandboxResult(
            exit_code=completed.returncode,
            stdout=_truncate(completed.stdout or "", settings.sandbox_output_limit_bytes),
            stderr=_truncate(completed.stderr or "", settings.sandbox_output_limit_bytes),
            duration_ms=duration,
            timed_out=False,
            backend="docker",
            extra=extra,
        )


def _run_process(files: dict[str, str], command: list[str], timeout: int,
               *, collect_trace: bool = False) -> SandboxResult:
    """Development fallback. Isolated tempdir + stripped env; not Docker.

    Used only when Docker is unavailable. Marked as backend=process so the UI
    never claims container isolation.
    """
    with tempfile.TemporaryDirectory(prefix="swarm-process-") as tmp:
        work = Path(tmp)
        _write_workspace(work, files)
        trace_file = work / "swarm_trace.jsonl"
        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": str(work),
            "TMPDIR": str(work),
            "PYTHONUNBUFFERED": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
            "SWARM_TRACE_PATH": str(trace_file),
        }
        argv = command[:]
        if argv and Path(argv[0]).name == "pytest":
            argv = [sys.executable, "-m", "pytest", *argv[1:]]
        started = time.monotonic()
        try:
            completed = subprocess.run(
                argv,
                cwd=work,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
                env=env,
            )
        except subprocess.TimeoutExpired as exc:
            duration = int((time.monotonic() - started) * 1000)
            stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
            stderr = exc.stderr.decode() if isinstance(exc.stderr, bytes) else (exc.stderr or "")
            return SandboxResult(
                exit_code=-1,
                stdout=_truncate(stdout, settings.sandbox_output_limit_bytes),
                stderr=_truncate(stderr, settings.sandbox_output_limit_bytes),
                duration_ms=duration,
                timed_out=True,
                backend="process",
            )
        duration = int((time.monotonic() - started) * 1000)
        extra: dict[str, str] = {}
        if collect_trace:
            try:
                if trace_file.exists():
                    extra["trace"] = _truncate(
                        trace_file.read_text(encoding="utf-8", errors="replace"),
                        settings.sandbox_output_limit_bytes)
            except OSError:
                pass
        return SandboxResult(
            exit_code=completed.returncode,
            stdout=_truncate(completed.stdout or "", settings.sandbox_output_limit_bytes),
            stderr=_truncate(completed.stderr or "", settings.sandbox_output_limit_bytes),
            duration_ms=duration,
            timed_out=False,
            backend="process",
            extra=extra,
        )


def run_sandbox(files: dict[str, str], test_command: str, *,
                trace: bool = False) -> SandboxResult:
    """Execute files in isolation. If trace=True, instrument suspicious
    sources with the runtime probe and collect SWARM_TRACE_PATH output
    into result.extra['trace'] (JSONL, truncated)."""
    _enter_queue()
    try:
        command = parse_test_command(test_command)
        timeout = settings.sandbox_timeout_seconds
        backend = resolve_backend()
        if backend == "process" and settings.sandbox_strict:
            return SandboxResult(
                exit_code=-1,
                stdout="",
                stderr="SANDBOX UNAVAILABLE: Docker is required in production mode "
                       "and no container backend is available. Refusing unsafe execution.",
                duration_ms=0,
                timed_out=False,
                backend="unavailable",
                error="SANDBOX UNAVAILABLE",
            )
        workspace = dict(files)
        if trace:
            try:
                from app.probe.tracer import instrument_files
                suspicious = [p for p in workspace if p.endswith(".py") and "test" not in p]
                workspace = instrument_files(workspace, suspicious=suspicious)
            except Exception:
                pass
        if backend == "docker":
            if not docker_available():
                if settings.sandbox_strict:
                    return SandboxResult(
                        exit_code=-1,
                        stdout="",
                        stderr="SANDBOX UNAVAILABLE: Docker is required and not available.",
                        duration_ms=0,
                        timed_out=False,
                        backend="unavailable",
                        error="SANDBOX UNAVAILABLE",
                    )
                return SandboxResult(
                    exit_code=-1,
                    stdout="",
                    stderr="Docker is not available",
                    duration_ms=0,
                    timed_out=False,
                    backend="docker",
                    error="Docker is not available",
                )
            return _run_docker(workspace, command, timeout, collect_trace=trace)
        return _run_process(workspace, command, timeout, collect_trace=trace)
    except ValueError as exc:
        return SandboxResult(
            exit_code=-1,
            stdout="",
            stderr=str(exc),
            duration_ms=0,
            timed_out=False,
            backend=resolve_backend(),
            error=str(exc),
        )
    finally:
        _leave_queue()


def isolation_note() -> str:
    backend = resolve_backend()
    if backend == "docker":
        return "Candidates run in Docker with network disabled and resource limits."
    return (
        "DEMO FALLBACK: Docker is unavailable, so execution uses a stripped-env "
        "temporary directory on this machine. This is weaker than container isolation."
    )
