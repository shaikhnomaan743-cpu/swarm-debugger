"""Extended persistence for the advanced Swarm Debugger.

New tables (all additive — existing tables untouched):
- evidence_items: unified evidence model
- trace_events: structured runtime-probe records
- fault_maps: per-round fault localizer output
- tool_calls: controlled agent-tool audit log
- causal_edges: causal debugging graph edges
- rejected_hypotheses: structured debug memory
- benchmark_cases / benchmark_runs
- experiments / experiment_runs
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.db.base import Base


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str | None] = mapped_column(ForeignKey("rounds.id"), nullable=True, index=True)
    candidate_id: Mapped[str | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(40), default="system")
    type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    agent: Mapped[str] = mapped_column(String(20), default="")
    title: Mapped[str] = mapped_column(String(300), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    verification_state: Mapped[str] = mapped_column(String(20), default="observed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TraceEvent(Base):
    __tablename__ = "trace_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str | None] = mapped_column(ForeignKey("rounds.id"), nullable=True)
    candidate_id: Mapped[str | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    execution_id: Mapped[str | None] = mapped_column(ForeignKey("executions.id"), nullable=True)
    seq: Mapped[int] = mapped_column(Integer, default=0)
    kind: Mapped[str] = mapped_column(String(40), default="call")
    function: Mapped[str] = mapped_column(String(200), default="")
    file: Mapped[str] = mapped_column(String(400), default="")
    line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    variables_json: Mapped[str] = mapped_column(Text, default="{}")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FaultMapRecord(Base):
    __tablename__ = "fault_maps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str] = mapped_column(ForeignKey("rounds.id"), nullable=False, index=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    files_json: Mapped[str] = mapped_column(Text, default="[]")
    symbols_json: Mapped[str] = mapped_column(Text, default="[]")
    failing_tests_json: Mapped[str] = mapped_column(Text, default="[]")
    regions_json: Mapped[str] = mapped_column(Text, default="[]")
    confidence: Mapped[float | None] = mapped_column(Integer, nullable=True)
    evidence_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str | None] = mapped_column(ForeignKey("rounds.id"), nullable=True)
    agent: Mapped[str] = mapped_column(String(20), default="")
    tool: Mapped[str] = mapped_column(String(80), default="")
    input_json: Mapped[str] = mapped_column(Text, default="{}")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CausalEdge(Base):
    __tablename__ = "causal_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str | None] = mapped_column(ForeignKey("rounds.id"), nullable=True)
    from_node: Mapped[str] = mapped_column(String(200), default="")
    from_type: Mapped[str] = mapped_column(String(40), default="")
    to_node: Mapped[str] = mapped_column(String(200), default="")
    to_type: Mapped[str] = mapped_column(String(40), default="")
    relation: Mapped[str] = mapped_column(String(80), default="leads_to")
    challenged: Mapped[bool] = mapped_column(Boolean, default=False)
    challenge_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RejectedHypothesis(Base):
    __tablename__ = "rejected_hypotheses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str | None] = mapped_column(ForeignKey("rounds.id"), nullable=True)
    candidate_id: Mapped[str | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    hypothesis: Mapped[str] = mapped_column(Text, default="")
    patch_hash: Mapped[str] = mapped_column(String(64), default="", index=True)
    failed_tests_json: Mapped[str] = mapped_column(Text, default="[]")
    trace_summary: Mapped[str] = mapped_column(Text, default="")
    counter_arguments: Mapped[str] = mapped_column(Text, default="")
    observed_behavior: Mapped[str] = mapped_column(Text, default="")
    rejection_reason: Mapped[str] = mapped_column(Text, default="")
    affected_symbols_json: Mapped[str] = mapped_column(Text, default="[]")
    repeated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class BenchmarkCase(Base):
    __tablename__ = "benchmark_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    category: Mapped[str] = mapped_column(String(40), default="logic")
    difficulty: Mapped[str] = mapped_column(String(20), default="easy")
    description: Mapped[str] = mapped_column(Text, default="")
    files_json: Mapped[str] = mapped_column(Text, default="[]")
    test_command: Mapped[str] = mapped_column(String(200), default="pytest -q")
    expected_behavior: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    case_id: Mapped[str] = mapped_column(ForeignKey("benchmark_cases.id"), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(20), default="D")
    status: Mapped[str] = mapped_column(String(20), default="failed")
    rounds_used: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)
    trace_events: Mapped[int] = mapped_column(Integer, default=0)
    repeated_hypothesis: Mapped[bool] = mapped_column(Boolean, default=False)
    detail_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    dataset_json: Mapped[str] = mapped_column(Text, default="[]")
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(20), default="created")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
