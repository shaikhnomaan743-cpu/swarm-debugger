"""Extended API: evidence, traces, replay, benchmarks, experiments, metrics,
causal graph, tool calls, sandbox monitor."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.benchmark.library import MODES, comparison_table, run_case, seed_cases
from app.core.errors import not_found
from app.evidence.engine import evidence_to_dict
from app.experiments.service import create_experiment, run_experiment
from app.metrics.collect import collect_metrics
from app.models import DebugSession, User
from app.models.extended import (
    BenchmarkCase, BenchmarkRun, CausalEdge, EvidenceItem, Experiment,
    FaultMapRecord, RejectedHypothesis, ToolCall, TraceEvent,
)
from app.sandbox.runner import docker_available, isolation_note, queue_depth, resolve_backend
from app.services.sessions import get_owned_session

router = APIRouter(prefix="/api", tags=["extended"])


def _owned(db: Session, session_id: str, user: User) -> DebugSession:
    return get_owned_session(db, session_id, user)


@router.get("/sessions/{session_id}/evidence")
def session_evidence(session_id: str, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user),
                     type: str | None = None):
    _owned(db, session_id, user)
    q = db.query(EvidenceItem).filter(EvidenceItem.session_id == session_id)
    if type:
        q = q.filter(EvidenceItem.type == type)
    return [evidence_to_dict(i) for i in q.order_by(EvidenceItem.created_at).all()]


@router.get("/sessions/{session_id}/traces")
def session_traces(session_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user),
                   candidate_id: str | None = None, limit: int = 300):
    _owned(db, session_id, user)
    q = db.query(TraceEvent).filter(TraceEvent.session_id == session_id)
    if candidate_id:
        q = q.filter(TraceEvent.candidate_id == candidate_id)
    items = q.order_by(TraceEvent.seq).limit(min(limit, 500)).all()
    return [{"id": t.id, "seq": t.seq, "kind": t.kind, "function": t.function,
             "file": t.file, "line": t.line,
             "variables": json.loads(t.variables_json or "{}"),
             "note": t.note, "candidate_id": t.candidate_id,
             "execution_id": t.execution_id} for t in items]


@router.get("/sessions/{session_id}/causal")
def session_causal(session_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    _owned(db, session_id, user)
    edges = db.query(CausalEdge).filter(CausalEdge.session_id == session_id).all()
    return [{"id": e.id, "from": e.from_node, "from_type": e.from_type,
             "to": e.to_node, "to_type": e.to_type, "relation": e.relation,
             "challenged": e.challenged, "challenge_note": e.challenge_note,
             "round_id": e.round_id} for e in edges]


@router.post("/sessions/{session_id}/causal/{edge_id}/challenge")
def challenge_causal(session_id: str, edge_id: str,
                     db: Session = Depends(get_db), user: User = Depends(get_current_user),
                     payload: dict | None = None):
    _owned(db, session_id, user)
    edge = db.get(CausalEdge, edge_id)
    if edge is None or edge.session_id != session_id:
        raise not_found("Edge not found")
    edge.challenged = True
    edge.challenge_note = str((payload or {}).get("note", ""))[:2000]
    db.commit()
    return {"status": "challenged", "id": edge.id}


@router.get("/sessions/{session_id}/memory")
def session_memory(session_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    _owned(db, session_id, user)
    items = db.query(RejectedHypothesis).filter(
        RejectedHypothesis.session_id == session_id).order_by(
        RejectedHypothesis.created_at).all()
    return [{"id": i.id, "round": i.round_number, "hypothesis": i.hypothesis,
             "patch_hash": i.patch_hash,
             "failed_tests": json.loads(i.failed_tests_json or "[]"),
             "trace_summary": i.trace_summary,
             "counter_arguments": i.counter_arguments,
             "observed_behavior": i.observed_behavior,
             "rejection_reason": i.rejection_reason,
             "affected_symbols": json.loads(i.affected_symbols_json or "[]"),
             "repeated": i.repeated, "candidate_id": i.candidate_id} for i in items]


@router.get("/sessions/{session_id}/faultmaps")
def session_faultmaps(session_id: str, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    _owned(db, session_id, user)
    items = db.query(FaultMapRecord).filter(
        FaultMapRecord.session_id == session_id).order_by(FaultMapRecord.round_number).all()
    return [{"round": i.round_number, "files": json.loads(i.files_json or "[]"),
             "symbols": json.loads(i.symbols_json or "[]"),
             "failing_tests": json.loads(i.failing_tests_json or "[]"),
             "regions": json.loads(i.regions_json or "[]"),
             "evidence": json.loads(i.evidence_json or "[]")} for i in items]


@router.get("/sessions/{session_id}/tools")
def session_tools(session_id: str, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    _owned(db, session_id, user)
    items = db.query(ToolCall).filter(ToolCall.session_id == session_id).order_by(
        ToolCall.created_at).all()
    return [{"id": t.id, "agent": t.agent, "tool": t.tool,
             "input": json.loads(t.input_json or "{}"),
             "result": json.loads(t.result_json or "{}"),
             "created_at": t.created_at.isoformat() if t.created_at else ""} for t in items]


@router.get("/sessions/{session_id}/replay")
def session_replay(session_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """Chronological T0..T9 event stream for the time-machine replay."""
    from app.models import SessionEvent
    from sqlalchemy import select
    _owned(db, session_id, user)
    events = db.scalars(select(SessionEvent).where(
        SessionEvent.session_id == session_id).order_by(SessionEvent.created_at)).all()
    return [{"id": e.id, "type": e.type, "message": e.message,
             "payload": json.loads(e.payload_json or "{}"),
             "created_at": e.created_at.isoformat() if e.created_at else ""} for e in events]


@router.get("/metrics")
def metrics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return collect_metrics(db, user.id)


@router.get("/metrics/global")
def metrics_global(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return collect_metrics(db, None)


@router.get("/sandbox/monitor")
def sandbox_monitor(user: User = Depends(get_current_user)):
    backend = resolve_backend()
    return {"backend": backend, "docker_available": docker_available(),
            "queue_depth": queue_depth(), "isolation_note": isolation_note(),
            "strict": backend != "process"}


@router.get("/benchmarks/cases")
def benchmark_cases(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    seed_cases(db)
    cases = db.query(BenchmarkCase).all()
    return [{"id": c.id, "slug": c.slug, "title": c.title, "category": c.category,
             "difficulty": c.difficulty, "description": c.description,
             "expected_behavior": c.expected_behavior} for c in cases]


class BenchmarkRunRequest(BaseModel):
    case_slug: str | None = None
    modes: list[str] = Field(default_factory=lambda: ["A", "B", "C", "D", "E"])


@router.post("/benchmarks/run")
def benchmarks_run(payload: BenchmarkRunRequest, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    seed_cases(db)
    cases = db.query(BenchmarkCase).all()
    if payload.case_slug:
        cases = [c for c in cases if c.slug == payload.case_slug]
    out = []
    for case in cases:
        for mode in payload.modes:
            if mode not in MODES:
                continue
            run = run_case(db, case, mode)
            out.append({"case": case.slug, "mode": mode, "status": run.status,
                        "duration_ms": run.duration_ms, "evidence": run.evidence_count,
                        "trace": run.trace_events})
    return {"runs": out, "comparison": comparison_table(db)}


@router.get("/benchmarks/comparison")
def benchmarks_comparison(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return comparison_table(db)


class ExperimentCreate(BaseModel):
    name: str
    dataset: list[str] = Field(default_factory=list)
    config: dict = Field(default_factory=dict)


@router.post("/experiments")
def experiments_create(payload: ExperimentCreate, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    seed_cases(db)
    exp = create_experiment(db, name=payload.name, dataset=payload.dataset,
                            config=payload.config or {"modes": ["A", "B", "C", "D", "E"]})
    return {"id": exp.id, "name": exp.name, "status": exp.status}


@router.post("/experiments/{experiment_id}/run")
def experiments_run(experiment_id: str, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    exp = db.get(Experiment, experiment_id)
    if exp is None:
        raise not_found("Experiment not found")
    return run_experiment(db, exp)


@router.get("/experiments")
def experiments_list(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = db.query(Experiment).order_by(Experiment.created_at.desc()).all()
    return [{"id": e.id, "name": e.name, "status": e.status,
             "dataset": json.loads(e.dataset_json or "[]"),
             "config": json.loads(e.config_json or "{}"),
             "result": json.loads(e.result_json or "{}")} for e in items]
