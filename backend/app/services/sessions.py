from __future__ import annotations

import hashlib
import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.agents.provider import get_provider
from app.core.clock import utcnow
from app.core.config import settings
from app.core.errors import not_found, validation_error
from app.core.files import classify_file, is_protected_path, normalize_path
from app.models import Candidate, DebugRound, DebugSession, ProjectFile, User
from app.sandbox.runner import docker_available, isolation_note, queue_depth, resolve_backend
from app.schemas.session import DashboardMetrics, SessionCreateRequest, SystemStatus

DEMO_DIR = Path(__file__).resolve().parents[1] / "data" / "demo_project"


def load_demo_files() -> list[tuple[str, str]]:
    files = []
    for path in sorted(DEMO_DIR.glob("*")):
        if path.is_file():
            files.append((path.name, path.read_text(encoding="utf-8")))
    return files


def get_owned_session(db: Session, session_id: str, user: User) -> DebugSession:
    item = db.get(DebugSession, session_id)
    if item is None or item.user_id != user.id:
        raise not_found("Session not found")
    return item


def load_session_graph(db: Session, session_id: str, user: User) -> DebugSession:
    stmt = (
        select(DebugSession)
        .where(DebugSession.id == session_id, DebugSession.user_id == user.id)
        .options(
            selectinload(DebugSession.files),
            selectinload(DebugSession.rounds).selectinload(DebugRound.candidates),
            selectinload(DebugSession.rounds).selectinload(DebugRound.decisions),
            selectinload(DebugSession.candidates),
            selectinload(DebugSession.executions),
            selectinload(DebugSession.messages),
            selectinload(DebugSession.decisions),
            selectinload(DebugSession.events),
        )
    )
    item = db.scalar(stmt)
    if item is None:
        raise not_found("Session not found")
    return item


def create_session(db: Session, user: User, payload: SessionCreateRequest) -> DebugSession:
    language = (payload.language or "python").strip().lower()
    if language != "python":
        raise validation_error("MVP supports Python only")
    files = [(item.path, item.content) for item in payload.files]
    if payload.use_demo_fixture or not files:
        files = load_demo_files()
        project_name = payload.project_name or "demo-divide"
        description = payload.description or "Demo: divide() crashes on zero instead of returning None."
        test_command = payload.test_command or "pytest -q"
        entry_point = "solution.py"
    else:
        project_name = payload.project_name.strip()
        description = payload.description
        test_command = payload.test_command.strip() or "pytest -q"
        entry_point = payload.entry_point.strip() or "solution.py"

    if len(files) > 20:
        raise validation_error("A session may include at most 20 files")

    seen: set[str] = set()
    stored: list[ProjectFile] = []
    try:
        for raw_path, content in files:
            path = normalize_path(raw_path)
            if path in seen:
                raise validation_error(f"Duplicate path: {path}")
            seen.add(path)
            kind = classify_file(path)
            stored.append(
                ProjectFile(
                    path=path,
                    content=content,
                    kind=kind,
                    protected=is_protected_path(path),
                )
            )
    except ValueError as exc:
        raise validation_error(str(exc)) from exc

    if not any(item.protected and item.kind == "test" for item in stored):
        raise validation_error("Include at least one protected test file")

    provider = get_provider()
    session = DebugSession(
        user_id=user.id,
        project_name=project_name,
        language=language,
        description=description,
        test_command=test_command,
        entry_point=entry_point,
        status="created",
        current_round=0,
        max_rounds=payload.max_rounds or settings.max_debug_rounds,
        demo_mode=provider.mode == "demo",
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    session.files = stored
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def dashboard_metrics(db: Session, user: User) -> DashboardMetrics:
    sessions = db.scalars(select(DebugSession).where(DebugSession.user_id == user.id)).all()
    active = sum(1 for item in sessions if item.status in {"created", "running"})
    verified = sum(1 for item in sessions if item.status == "verified")
    session_ids = [item.id for item in sessions]
    failed = 0
    if session_ids:
        failed = db.scalar(
            select(func.count()).select_from(Candidate).where(
                Candidate.session_id.in_(session_ids),
                Candidate.status.in_(["FAILED", "REJECTED", "TIMEOUT", "SANDBOX_ERROR"]),
            )
        ) or 0
    finished = [item for item in sessions if item.current_round > 0]
    average = (
        sum(item.current_round for item in finished) / len(finished) if finished else 0.0
    )
    return DashboardMetrics(
        active_sessions=active,
        verified_fixes=verified,
        failed_candidates=int(failed),
        average_rounds=round(average, 2),
    )


def system_status() -> SystemStatus:
    provider = get_provider()
    backend = resolve_backend()
    return SystemStatus(
        sandbox_backend=backend,
        sandbox_available=backend == "process" or docker_available(),
        docker_available=docker_available(),
        queue_depth=queue_depth(),
        timeout_seconds=settings.sandbox_timeout_seconds,
        memory_mb=settings.sandbox_memory_mb,
        cpu_limit=settings.sandbox_cpu_limit,
        llm_mode=provider.mode,
        llm_model=provider.model,
        max_debug_rounds=settings.max_debug_rounds,
        isolation_note=isolation_note(),
    )


def content_hash(files: list[dict]) -> str:
    blob = json.dumps(sorted(files, key=lambda item: item.get("path", "")), sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()
