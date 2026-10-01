from __future__ import annotations

import json

from app.core.pytest_parse import loads_list
from app.models import (
    AgentMessage,
    Candidate,
    DebugRound,
    DebugSession,
    Execution,
    JudgeDecision,
    ProjectFile,
    SessionEvent,
)
from app.schemas.session import (
    AgentMessageOut,
    CandidateOut,
    ExecutionOut,
    FileInput,
    FileOut,
    JudgeDecisionOut,
    RoundOut,
    SessionDetail,
    SessionEventOut,
    SessionSummary,
)


def iso(value) -> str:
    return value.isoformat() if value else ""


def file_out(item: ProjectFile) -> FileOut:
    return FileOut(
        id=item.id,
        path=item.path,
        content=item.content,
        kind=item.kind,
        protected=item.protected,
    )


def execution_out(item: Execution) -> ExecutionOut:
    return ExecutionOut(
        id=item.id,
        session_id=item.session_id,
        round_id=item.round_id,
        candidate_id=item.candidate_id,
        kind=item.kind,
        status=item.status,
        exit_code=item.exit_code,
        duration_ms=item.duration_ms,
        stdout=item.stdout,
        stderr=item.stderr,
        tests_total=item.tests_total,
        tests_passed=item.tests_passed,
        tests_failed=item.tests_failed,
        timed_out=item.timed_out,
        protected_files_tampered=item.protected_files_tampered,
        sandbox_backend=item.sandbox_backend,
        failure_summary=item.failure_summary,
        created_at=iso(item.created_at),
    )


def candidate_out(item: Candidate) -> CandidateOut:
    files_raw = loads_list(item.files_json)
    files = [FileInput.model_validate(entry) for entry in files_raw if isinstance(entry, dict)]
    return CandidateOut(
        id=item.id,
        session_id=item.session_id,
        round_id=item.round_id,
        agent=item.agent,
        root_cause=item.root_cause,
        hypothesis=item.hypothesis,
        patch_summary=item.patch_summary,
        files=files,
        files_changed=loads_list(item.files_changed_json),
        expected_result=item.expected_result,
        expected_tests=loads_list(item.expected_tests_json),
        objections=item.objections,
        falsification_tests=item.falsification_tests,
        status=item.status,
        demo_mode=item.demo_mode,
        created_at=iso(item.created_at),
    )


def decision_out(item: JudgeDecision) -> JudgeDecisionOut:
    return JudgeDecisionOut(
        id=item.id,
        session_id=item.session_id,
        round_id=item.round_id,
        candidate_id=item.candidate_id,
        verdict=item.verdict,
        reason=item.reason,
        evidence_summary=item.evidence_summary,
        llm_explanation=item.llm_explanation,
        created_at=iso(item.created_at),
    )


def round_out(item: DebugRound, *, include_children: bool = False) -> RoundOut:
    body = RoundOut(
        id=item.id,
        session_id=item.session_id,
        number=item.number,
        status=item.status,
        summary=item.summary,
        created_at=iso(item.created_at),
    )
    if include_children:
        body.candidates = [candidate_out(candidate) for candidate in item.candidates]
        body.decisions = [decision_out(decision) for decision in item.decisions]
    return body


def session_summary(item: DebugSession) -> SessionSummary:
    return SessionSummary(
        id=item.id,
        project_name=item.project_name,
        language=item.language,
        status=item.status,
        current_round=item.current_round,
        max_rounds=item.max_rounds,
        demo_mode=item.demo_mode,
        terminated_reason=item.terminated_reason,
        created_at=iso(item.created_at),
        updated_at=iso(item.updated_at),
    )


def session_detail(item: DebugSession) -> SessionDetail:
    rounds = sorted(item.rounds, key=lambda round_item: round_item.number)
    return SessionDetail(
        **session_summary(item).model_dump(),
        description=item.description,
        test_command=item.test_command,
        entry_point=item.entry_point,
        last_error=item.last_error,
        files=[file_out(entry) for entry in item.files],
        rounds=[round_out(entry, include_children=True) for entry in rounds],
        executions=[execution_out(entry) for entry in sorted(item.executions, key=lambda x: x.created_at)],
        messages=[
            AgentMessageOut(
                id=message.id,
                session_id=message.session_id,
                round_id=message.round_id,
                agent=message.agent,
                role=message.role,
                content=message.content,
                created_at=iso(message.created_at),
            )
            for message in sorted(item.messages, key=lambda x: x.created_at)
        ],
        events=[
            SessionEventOut(
                id=event.id,
                session_id=event.session_id,
                type=event.type,
                message=event.message,
                created_at=iso(event.created_at),
            )
            for event in sorted(item.events, key=lambda x: x.created_at)
        ],
    )


def dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)
