from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.clock import utcnow
from app.core.errors import conflict, not_found, validation_error
from app.models import Candidate, DebugRound, DebugSession, Execution, User
from app.schemas.session import (
    CandidateOut,
    DashboardMetrics,
    ExecutionOut,
    RoundOut,
    SessionCreateRequest,
    SessionDetail,
    SessionSummary,
    SystemStatus,
)
from app.services.orchestrator import run_debug_loop, start_session_background
from app.services.serialize import candidate_out, execution_out, round_out, session_detail, session_summary
from app.services.sessions import (
    create_session,
    dashboard_metrics,
    get_owned_session,
    load_session_graph,
    system_status,
)

router = APIRouter(prefix="/api", tags=["sessions"])


def _user_session(db: Session, session_id: str, user: User) -> DebugSession:
    return get_owned_session(db, session_id, user)


@router.get("/system/status", response_model=SystemStatus)
def get_system_status(_user: User = Depends(get_current_user)) -> SystemStatus:
    return system_status()


@router.get("/dashboard/metrics", response_model=DashboardMetrics)
def metrics(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DashboardMetrics:
    return dashboard_metrics(db, user)


@router.post("/sessions", response_model=SessionSummary)
def create(
    payload: SessionCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionSummary:
    created = create_session(db, user, payload)
    return session_summary(created)


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[SessionSummary]:
    items = db.scalars(
        select(DebugSession)
        .where(DebugSession.user_id == user.id)
        .order_by(DebugSession.updated_at.desc())
    ).all()
    return [session_summary(item) for item in items]


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionDetail:
    return session_detail(load_session_graph(db, session_id, user))


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    item = _user_session(db, session_id, user)
    if item.status == "running":
        raise conflict("Cancel the session before deleting it")
    db.delete(item)
    db.commit()
    return {"status": "ok"}


@router.post("/sessions/{session_id}/start", response_model=SessionSummary)
def start_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionSummary:
    item = _user_session(db, session_id, user)
    if item.status == "running":
        raise conflict("Session is already running")
    if item.status not in {"created"}:
        raise conflict("Only new sessions can be started")
    item.status = "running"
    item.updated_at = utcnow()
    db.commit()
    start_session_background(item.id)
    return session_summary(item)


@router.post("/sessions/{session_id}/start-sync", response_model=SessionDetail)
def start_session_sync(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionDetail:
    """Run the debug loop on this worker (used by tests and local demos)."""
    item = _user_session(db, session_id, user)
    if item.status not in {"created"}:
        raise conflict("Only new sessions can be started")
    run_debug_loop(item.id)
    db.expire_all()
    return session_detail(load_session_graph(db, session_id, user))


@router.post("/sessions/{session_id}/cancel", response_model=SessionSummary)
def cancel_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionSummary:
    item = _user_session(db, session_id, user)
    if item.status not in {"running", "created"}:
        raise conflict("Session cannot be cancelled")
    item.status = "cancelled"
    item.terminated_reason = "cancelled"
    item.updated_at = utcnow()
    db.commit()
    return session_summary(item)


@router.get("/sessions/{session_id}/rounds", response_model=list[RoundOut])
def list_rounds(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RoundOut]:
    _user_session(db, session_id, user)
    rounds = db.scalars(
        select(DebugRound).where(DebugRound.session_id == session_id).order_by(DebugRound.number)
    ).all()
    return [round_out(item, include_children=True) for item in rounds]


@router.get("/rounds/{round_id}", response_model=RoundOut)
def get_round(
    round_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RoundOut:
    item = db.get(DebugRound, round_id)
    if item is None:
        raise not_found("Round not found")
    _user_session(db, item.session_id, user)
    return round_out(item, include_children=True)


@router.get("/rounds/{round_id}/candidates", response_model=list[CandidateOut])
def list_candidates(
    round_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CandidateOut]:
    item = db.get(DebugRound, round_id)
    if item is None:
        raise not_found("Round not found")
    _user_session(db, item.session_id, user)
    return [candidate_out(candidate) for candidate in item.candidates]


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CandidateOut:
    item = db.get(Candidate, candidate_id)
    if item is None:
        raise not_found("Candidate not found")
    _user_session(db, item.session_id, user)
    return candidate_out(item)


@router.post("/candidates/{candidate_id}/execute", response_model=ExecutionOut)
def execute_candidate(
    candidate_id: str,
    _db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ExecutionOut:
    raise validation_error("Manual candidate execution is disabled; start the session instead")


@router.get("/executions/{execution_id}", response_model=ExecutionOut)
def get_execution(
    execution_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ExecutionOut:
    item = db.get(Execution, execution_id)
    if item is None:
        raise not_found("Execution not found")
    _user_session(db, item.session_id, user)
    return execution_out(item)
