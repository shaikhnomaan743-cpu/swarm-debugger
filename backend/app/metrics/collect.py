"""System observability from real DB state — never random values."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Candidate, DebugSession, Execution, JudgeDecision
from app.models.extended import EvidenceItem, RejectedHypothesis, TraceEvent


def collect_metrics(db: Session, user_id: str | None = None) -> dict:
    session_q = select(DebugSession)
    if user_id:
        session_q = session_q.where(DebugSession.user_id == user_id)
    sessions = db.scalars(session_q).all()
    ids = [s.id for s in sessions]
    executions = db.scalars(select(Execution).where(
        Execution.session_id.in_(ids))).all() if ids else []
    candidates = db.scalars(select(Candidate).where(
        Candidate.session_id.in_(ids))).all() if ids else []
    decisions = db.scalars(select(JudgeDecision).where(
        JudgeDecision.session_id.in_(ids))).all() if ids else []
    evidence = db.scalar(select(func.count()).select_from(EvidenceItem).where(
        EvidenceItem.session_id.in_(ids))) if ids else 0
    traces = db.scalar(select(func.count()).select_from(TraceEvent).where(
        TraceEvent.session_id.in_(ids))) if ids else 0
    rejected = db.scalar(select(func.count()).select_from(RejectedHypothesis).where(
        RejectedHypothesis.session_id.in_(ids))) if ids else 0
    verified = sum(1 for s in sessions if s.status == "verified")
    finished = [s for s in sessions if s.current_round > 0]
    avg_rounds = round(sum(s.current_round for s in finished) / len(finished), 2) if finished else 0.0
    exec_times = [e.duration_ms for e in executions if e.duration_ms]
    avg_exec = int(sum(exec_times) / len(exec_times)) if exec_times else 0
    sandbox_errors = sum(1 for e in executions if e.status == "SANDBOX_ERROR")
    timeouts = sum(1 for e in executions if e.timed_out)
    repeated = db.scalar(select(func.count()).select_from(RejectedHypothesis).where(
        RejectedHypothesis.session_id.in_(ids),
        RejectedHypothesis.repeated.is_(True))) if ids else 0
    disagreements = 0
    for d in decisions:
        pass
    # disagreement: rounds where both candidates were judged differently
    from collections import defaultdict
    by_round: dict[str, set[str]] = defaultdict(set)
    for d in decisions:
        by_round[d.round_id].add(d.verdict)
    disagreements = sum(1 for v in by_round.values() if len(v) > 1)
    verdicts: dict[str, int] = {}
    for d in decisions:
        verdicts[d.verdict] = verdicts.get(d.verdict, 0) + 1
    return {
        "active_sessions": sum(1 for s in sessions if s.status in ("created", "running")),
        "total_sessions": len(sessions),
        "verified_fixes": verified,
        "rejected_patches": rejected or 0,
        "failed_candidates": sum(1 for c in candidates if c.status in (
            "FAILED", "REJECTED", "TIMEOUT", "SANDBOX_ERROR")),
        "average_rounds": avg_rounds,
        "average_execution_ms": avg_exec,
        "executions": len(executions),
        "sandbox_errors": sandbox_errors,
        "timeouts": timeouts,
        "repeated_hypotheses": repeated or 0,
        "agent_disagreements": disagreements,
        "trace_events": traces or 0,
        "evidence_items": evidence or 0,
        "judge_verdicts": verdicts,
    }
