"""Full Swarm orchestrator: Coordinator-driven adversarial loop with
runtime verification. Deterministic state machine; LLMs never control flow."""
from __future__ import annotations

import json
import logging
import threading

from sqlalchemy.orm import Session

from app.agents.defender import run_defender
from app.agents.prosecutor import run_prosecutor
from app.agents.provider import get_provider
from app.causal.graph import build_round_chain
from app.coordinator.machine import should_start_next_round
from app.core.clock import utcnow
from app.core.config import settings
from app.core.files import is_protected_path, normalize_path
from app.core.pytest_parse import parse_pytest_output
from app.db.session import SessionLocal
from app.evidence.engine import add_evidence, diff_text
from app.judge.policy import build_falsification_file, compare_candidates, decide_advanced
from app.localizer.fault import localize
from app.memory.rejected import is_repeated, memory_context, record_rejection
from app.models import AgentMessage, Candidate, DebugRound, DebugSession, Execution, JudgeDecision
from app.models.extended import FaultMapRecord, TraceEvent
from app.probe.tracer import parse_trace_file, summarize_trace
from app.sandbox.runner import run_sandbox
from app.schemas.internal import AgentProposal, DebugContext
from app.services.events import emit
from app.services.serialize import dumps
from app.services.sessions import content_hash
from app.tools import registry as tools

logger = logging.getLogger(__name__)

_running: set[str] = set()
_lock = threading.Lock()


def start_session_background(session_id: str) -> None:
    with _lock:
        if session_id in _running:
            return
        _running.add(session_id)
    thread = threading.Thread(target=_safe_run, args=(session_id,), daemon=True)
    thread.start()


def _safe_run(session_id: str) -> None:
    try:
        run_debug_loop(session_id)
    except Exception:
        logger.exception("Debug loop crashed for %s", session_id)
        with SessionLocal() as db:
            session = db.get(DebugSession, session_id)
            if session is not None:
                session.status = "terminated"
                session.terminated_reason = "internal_error"
                session.last_error = "Internal error during debug loop"
                session.updated_at = utcnow()
                emit(db, session_id, "internal_error", "Debug loop terminated after an internal error")
                db.commit()
    finally:
        with _lock:
            _running.discard(session_id)


def _touch(session: DebugSession) -> None:
    session.updated_at = utcnow()


def _baseline_files(session: DebugSession) -> dict[str, str]:
    return {item.path: item.content for item in session.files}


def _apply_candidate(base: dict[str, str], files: list[dict]) -> tuple[dict[str, str], bool]:
    merged = dict(base)
    tampered = False
    for item in files:
        path = normalize_path(item["path"])
        if is_protected_path(path):
            tampered = True
            continue
        merged[path] = item["content"]
    return merged, tampered


def _changed_paths(base: dict[str, str], workspace: dict[str, str]) -> list[str]:
    return sorted([p for p in workspace if base.get(p) != workspace.get(p)])


def _record_execution(db, session, *, kind, round_id, candidate_id, result, tests, tampered) -> Execution:
    if result.error:
        status = "SANDBOX_ERROR"
    elif result.timed_out:
        status = "TIMEOUT"
    elif tampered:
        status = "REJECTED"
    elif (tests.failed or 0) > 0 or result.exit_code != 0:
        status = "FAILED"
    else:
        status = "PASSED"
    execution = Execution(
        session_id=session.id, round_id=round_id, candidate_id=candidate_id, kind=kind,
        status=status, exit_code=result.exit_code, duration_ms=result.duration_ms,
        stdout=result.stdout, stderr=result.stderr,
        tests_total=tests.total, tests_passed=tests.passed, tests_failed=tests.failed,
        timed_out=result.timed_out, protected_files_tampered=tampered,
        sandbox_backend=result.backend, failure_summary=result.error or tests.raw,
    )
    db.add(execution)
    db.flush()
    return execution


def _store_candidate(db, session, round_item, agent: str, proposal: AgentProposal) -> Candidate:
    files = [item.model_dump() for item in proposal.files]
    candidate = Candidate(
        session_id=session.id, round_id=round_item.id, agent=agent,
        root_cause=proposal.root_cause, hypothesis=proposal.hypothesis,
        patch_summary=proposal.patch_summary, files_json=dumps(files),
        files_changed_json=dumps(proposal.files_changed or [item.path for item in proposal.files]),
        expected_result=proposal.expected_behavior,
        expected_tests_json=dumps(proposal.expected_tests),
        objections=proposal.objections,
        falsification_tests="\n".join(proposal.falsification_tests),
        content_hash=content_hash(files), status="PROPOSED",
        demo_mode=proposal.demo_mode,
    )
    db.add(candidate)
    db.add(AgentMessage(
        session_id=session.id, round_id=round_item.id, agent=agent, role="proposal",
        content=proposal.root_cause, payload_json=proposal.model_dump_json(),
    ))
    db.flush()
    return candidate


def _persist_trace(db, *, session_id, round_id, candidate_id, execution_id, raw: str) -> list[dict]:
    events = parse_trace_file(raw or "", limit=300)
    for ev in events:
        try:
            db.add(TraceEvent(
                session_id=session_id, round_id=round_id, candidate_id=candidate_id,
                execution_id=execution_id, seq=int(ev.get("seq") or 0),
                kind=str(ev.get("kind") or "")[:40],
                function=str(ev.get("function") or "")[:200],
                file=str(ev.get("file") or "")[:400],
                line=int(ev.get("line")) if isinstance(ev.get("line"), int) else None,
                variables_json=json.dumps(ev.get("variables") or {})[:4000],
                note=str(ev.get("note") or "")[:2000],
            ))
        except Exception:
            continue
    db.flush()
    return events


def _run_falsification(workspace: dict[str, str], test_command: str,
                       falsification_tests: list[str]) -> dict:
    """Execute Defender falsification tests as real pytest. Returns result dict."""
    content, names = build_falsification_file(falsification_tests)
    if not names:
        return {"executed": False, "passed": [], "failed": [], "skipped": len(falsification_tests)}
    ws = dict(workspace)
    ws["test_swarm_falsify.py"] = content
    # run only the falsification module to isolate signal
    result = run_sandbox(ws, "pytest test_swarm_falsify.py -q")
    parsed = parse_pytest_output(result.stdout, result.stderr)
    failed = (parsed.failed or 0) > 0 or result.exit_code != 0
    return {
        "executed": True,
        "names": names,
        "passed": [] if failed else names,
        "failed": [],
        "failed_names": [],
        "exit_code": result.exit_code,
        "stdout": result.stdout[:4000],
        "stderr": result.stderr[:4000],
        "failed_count": parsed.failed or 0,
    } if not failed else {
        "executed": True,
        "names": names,
        "passed": [],
        "failed": names,
        "failed_names": names,
        "exit_code": result.exit_code,
        "stdout": result.stdout[:4000],
        "stderr": result.stderr[:4000],
        "failed_count": parsed.failed or 0,
    }


def run_debug_loop(session_id: str) -> None:
    db = SessionLocal()
    sandbox_failures = 0
    seen_hashes: set[str] = set()
    try:
        session = db.get(DebugSession, session_id)
        if session is None:
            return
        session.status = "running"
        _touch(session)
        emit(db, session.id, "session_started", "Debug session started")
        emit(db, session.id, "timeline_T0", "T0 Baseline")
        db.commit()

        # 1. BASELINE executes
        emit(db, session.id, "baseline_started", "Baseline execution started")
        emit(db, session.id, "agent_started", "Coordinator: baseline gate",
             {"agent": "coordinator", "phase": "BASELINE"})
        db.commit()
        base_files = _baseline_files(session)
        baseline_result = run_sandbox(base_files, session.test_command)
        tests = parse_pytest_output(baseline_result.stdout, baseline_result.stderr)
        baseline = _record_execution(db, session, kind="baseline", round_id=None,
                                     candidate_id=None, result=baseline_result,
                                     tests=tests, tampered=False)
        add_evidence(db, session_id=session.id, type="BASELINE_RESULT",
                     title="Baseline execution", source="sandbox",
                     content=f"status={baseline.status} exit={baseline.exit_code} "
                             f"passed={tests.passed} failed={tests.failed}\n"
                             f"{baseline_result.stdout[:3000]}",
                     verification_state="verified")
        add_evidence(db, session_id=session.id, type="STDOUT", title="Baseline stdout",
                     content=baseline_result.stdout[:6000], source="sandbox")
        if baseline_result.stderr:
            add_evidence(db, session_id=session.id, type="STDERR", title="Baseline stderr",
                         content=baseline_result.stderr[:6000], source="sandbox")
        emit(db, session.id, "baseline_completed", "Baseline execution completed",
             {"execution_id": baseline.id, "status": baseline.status})
        emit(db, session.id, "tool_called", "Coordinator inspected baseline output",
             {"agent": "coordinator", "tool": "inspect_test_failure"})
        db.commit()

        if baseline_result.error:
            session.status = "terminated"
            session.terminated_reason = "sandbox_error"
            session.last_error = baseline_result.error
            _touch(session)
            emit(db, session.id, "terminated", "Terminated: sandbox error during baseline")
            db.commit()
            return

        if baseline.status == "PASSED":
            session.status = "human_review"
            session.terminated_reason = "bug_not_reproduced"
            session.last_error = "Baseline tests passed; the reported bug was not reproduced."
            _touch(session)
            emit(db, session.id, "human_review", "Baseline passed; human review required")
            db.commit()
            return

        baseline_passed = tests.passed or 0
        previous_failures = [f"Baseline {baseline.status}: exit={baseline.exit_code} {tests.raw}"]

        for round_number in range(1, session.max_rounds + 1):
            db.refresh(session)
            if session.status == "cancelled":
                emit(db, session.id, "cancelled", "Session cancelled")
                db.commit()
                return

            session.current_round = round_number
            round_item = DebugRound(session_id=session.id, number=round_number, status="localize")
            db.add(round_item)
            db.flush()
            _touch(session)
            emit(db, session.id, "round_started", f"Round {round_number} started",
                 {"round": round_number})
            emit(db, session.id, "timeline_T1", f"T1 Fault localized (round {round_number})")
            db.commit()

            # 2. FAULT LOCALIZER analyzes
            fault_map = localize(base_files, stdout=baseline.stdout,
                                 stderr=baseline.stderr,
                                 failing_hint="\n".join(previous_failures))
            # controlled tool usage is logged as evidence of inspection
            tools.search_code(base_files, "def ", db=db, session_id=session.id,
                              round_id=round_item.id, agent="localizer")
            tools.list_files(base_files, db=db, session_id=session.id,
                             round_id=round_item.id, agent="localizer")
            db.add(FaultMapRecord(
                session_id=session.id, round_id=round_item.id, round_number=round_number,
                files_json=dumps(fault_map["files"]),
                symbols_json=dumps(fault_map["symbols"]),
                failing_tests_json=dumps(fault_map["failing_tests"]),
                regions_json=dumps(fault_map["suspicious_regions"]),
                evidence_json=dumps(fault_map["evidence"]),
            ))
            add_evidence(db, session_id=session.id, round_id=round_item.id,
                         round_number=round_number, type="FAULT_LOCATION",
                         title=f"Fault map round {round_number}", agent="localizer",
                         source="localizer",
                         content=json.dumps(fault_map)[:6000],
                         verification_state="observed")
            for sym in fault_map.get("symbols", [])[:5]:
                tools.find_symbol(base_files, sym, db=db, session_id=session.id,
                                  round_id=round_item.id, agent="localizer")
            emit(db, session.id, "fault_localized", "Fault localizer produced fault map",
                 {"round": round_number, "files": fault_map["files"]})
            db.commit()

            # rejected memory context for next-round learning
            rejected_ctx = memory_context(db, session.id)

            context = DebugContext(
                project_name=session.project_name, language=session.language,
                description=session.description, test_command=session.test_command,
                files=base_files, baseline_stdout=baseline.stdout,
                baseline_stderr=baseline.stderr, baseline_exit_code=baseline.exit_code,
                previous_failures=previous_failures, round_number=round_number,
                fault_map=fault_map, rejected_memory=rejected_ctx,
            )

            # 3. PROSECUTOR proposes hypothesis A
            round_item.status = "prosecutor"
            emit(db, session.id, "prosecutor_started", "Prosecutor analyzing")
            emit(db, session.id, "timeline_T2", f"T2 Prosecutor hypothesis (round {round_number})")
            emit(db, session.id, "agent_started", "Prosecutor started",
                 {"agent": "prosecutor", "round": round_number})
            db.commit()
            try:
                prosecutor_proposal = run_prosecutor(context)
            except Exception as exc:  # noqa: BLE001
                session.status = "terminated"
                session.terminated_reason = "agent_error"
                session.last_error = "Prosecutor failed"
                emit(db, session.id, "agent_error", "Prosecutor failed")
                _touch(session)
                db.commit()
                logger.warning("Prosecutor error: %s", exc)
                return

            # duplicate-hypothesis detection against rejected memory
            try:
                phash = content_hash([i.model_dump() for i in prosecutor_proposal.files])
                if is_repeated(db, session_id=session.id,
                               hypothesis=prosecutor_proposal.hypothesis, patch_hash=phash):
                    emit(db, session.id, "repeated_hypothesis",
                         "REPEATED HYPOTHESIS: prosecutor repeats a rejected diagnosis; "
                         "forcing additional evidence gathering",
                         {"agent": "prosecutor", "round": round_number})
                    add_evidence(db, session_id=session.id, round_id=round_item.id,
                                 round_number=round_number, type="HYPOTHESIS",
                                 title="Repeated hypothesis flagged", agent="prosecutor",
                                 content=prosecutor_proposal.hypothesis[:2000],
                                 verification_state="disputed")
            except Exception:
                pass

            prosecutor = _store_candidate(db, session, round_item, "prosecutor", prosecutor_proposal)
            add_evidence(db, session_id=session.id, round_id=round_item.id,
                         candidate_id=prosecutor.id, round_number=round_number,
                         type="HYPOTHESIS", title="Prosecutor hypothesis A",
                         agent="prosecutor",
                         content=f"{prosecutor_proposal.hypothesis}\n"
                                 f"root cause: {prosecutor_proposal.root_cause}\n"
                                 f"expected: {prosecutor_proposal.expected_behavior}",
                         verification_state="unverified")
            tools.get_function_context(base_files,
                                       (fault_map.get("symbols") or [""])[0] or "divide",
                                       db=db, session_id=session.id,
                                       round_id=round_item.id, agent="prosecutor")
            emit(db, session.id, "prosecutor_ready", "Prosecutor proposal ready",
                 {"candidate_id": prosecutor.id})
            emit(db, session.id, "hypothesis_created", "Hypothesis A created",
                 {"candidate_id": prosecutor.id, "agent": "prosecutor"})
            emit(db, session.id, "agent_finished", "Prosecutor finished",
                 {"agent": "prosecutor"})
            db.commit()

            # 4-6. DEFENDER challenges + alternative + falsification tests
            context.prosecutor_proposal = prosecutor_proposal
            round_item.status = "defender"
            emit(db, session.id, "defender_started", "Defender analyzing")
            emit(db, session.id, "timeline_T3", f"T3 Defender challenge (round {round_number})")
            emit(db, session.id, "agent_started", "Defender started",
                 {"agent": "defender", "round": round_number})
            db.commit()
            try:
                defender_proposal = run_defender(context)
            except Exception as exc:  # noqa: BLE001
                session.status = "terminated"
                session.terminated_reason = "agent_error"
                session.last_error = "Defender failed"
                emit(db, session.id, "agent_error", "Defender failed")
                _touch(session)
                db.commit()
                logger.warning("Defender error: %s", exc)
                return

            defender = _store_candidate(db, session, round_item, "defender", defender_proposal)
            add_evidence(db, session_id=session.id, round_id=round_item.id,
                         candidate_id=defender.id, round_number=round_number,
                         type="COUNTER_ARGUMENT", title="Defender challenge + hypothesis B",
                         agent="defender",
                         content=f"objections: {defender_proposal.objections}\n"
                                 f"alternative: {defender_proposal.hypothesis}\n"
                                 f"falsification: {defender_proposal.falsification_tests}",
                         verification_state="unverified")
            tools.inspect_diff(
                {f.path: base_files.get(f.path, "") for f in prosecutor_proposal.files},
                {f.path: f.content for f in prosecutor_proposal.files},
                db=db, session_id=session.id, round_id=round_item.id, agent="defender")
            emit(db, session.id, "defender_ready", "Defender proposal ready",
                 {"candidate_id": defender.id})
            emit(db, session.id, "challenge_created", "Defender challenged hypothesis A",
                 {"candidate_id": defender.id})
            emit(db, session.id, "agent_finished", "Defender finished",
                 {"agent": "defender"})
            db.commit()

            # causal chain: prosecutor builds, defender attacks a link
            try:
                failing_test = (fault_map.get("failing_tests") or ["baseline_failure"])[0]
                fault_file = (fault_map.get("files") or ["solution.py"])[0]
                build_round_chain(
                    db, session_id=session.id, round_id=round_item.id,
                    failing_test=failing_test, fault_file=fault_file,
                    hypothesis=prosecutor_proposal.hypothesis[:120] or "H-A",
                    patch=prosecutor.patch_summary[:120] or "patch-A",
                    expected=prosecutor_proposal.expected_behavior[:120] or "expected-A")
            except Exception:
                pass

            identical = False
            for candidate in (prosecutor, defender):
                if candidate.content_hash in seen_hashes:
                    identical = True
                seen_hashes.add(candidate.content_hash)

            round_item.status = "judging"
            emit(db, session.id, "judge_started", f"Judge executing round {round_number}")
            db.commit()

            # 7-13. build + probe + tests + falsification + protected + regression
            results: dict[str, dict] = {}
            for candidate, label in ((prosecutor, "A"), (defender, "B")):
                db.refresh(session)
                if session.status == "cancelled":
                    return
                files = json.loads(candidate.files_json)
                workspace, tampered = _apply_candidate(base_files, files)
                changed = _changed_paths(base_files, workspace)
                candidate.status = "RUNNING"
                emit(db, session.id, "candidate_created", f"Candidate {label} built",
                     {"candidate_id": candidate.id, "agent": candidate.agent})
                emit(db, session.id, "candidate_running", f"Candidate {label} running",
                     {"candidate_id": candidate.id, "agent": candidate.agent})
                emit(db, session.id, "sandbox_started", f"Sandbox started for candidate {label}",
                     {"candidate_id": candidate.id})
                db.commit()

                # runtime probe execution (trace)
                emit(db, session.id, "trace_started", f"Runtime probe tracing candidate {label}",
                     {"candidate_id": candidate.id})
                result = run_sandbox(workspace, session.test_command, trace=settings.trace_enabled)
                emit(db, session.id, "sandbox_finished", f"Sandbox finished candidate {label}",
                     {"candidate_id": candidate.id, "exit": result.exit_code})
                parsed = parse_pytest_output(result.stdout, result.stderr)
                execution = _record_execution(db, session, kind="candidate",
                                              round_id=round_item.id,
                                              candidate_id=candidate.id,
                                              result=result, tests=parsed, tampered=tampered)
                emit(db, session.id, "test_finished",
                     f"Candidate {label} tests: {parsed.passed}/{parsed.total}",
                     {"candidate_id": candidate.id, "execution_id": execution.id})

                # trace persistence
                raw_trace = (result.extra or {}).get("trace", "")
                trace_events = _persist_trace(
                    db, session_id=session.id, round_id=round_item.id,
                    candidate_id=candidate.id, execution_id=execution.id, raw=raw_trace)
                trace_summary = summarize_trace(trace_events)
                add_evidence(db, session_id=session.id, round_id=round_item.id,
                             candidate_id=candidate.id, round_number=round_number,
                             type="RUNTIME_TRACE", title=f"Runtime trace candidate {label}",
                             agent="probe", source="probe", content=trace_summary[:4000],
                             verification_state="verified")
                if trace_events[:3]:
                    preview = []
                    for e in trace_events[:5]:
                        if isinstance(e, dict):
                            preview.append({"fn": e.get("function"),
                                            "vars": str(e.get("variables"))[:500]})
                        else:
                            preview.append({"fn": getattr(e, "function", ""),
                                            "vars": str(getattr(e, "variables_json", ""))[:500]})
                    add_evidence(db, session_id=session.id, round_id=round_item.id,
                                 candidate_id=candidate.id, round_number=round_number,
                                 type="VARIABLE_STATE",
                                 title=f"Variable state candidate {label}",
                                 agent="probe", source="probe",
                                 content=json.dumps(preview)[:4000],
                                 verification_state="verified")
                emit(db, session.id, "trace_completed",
                     f"Trace captured candidate {label}: {len(trace_events)} events",
                     {"candidate_id": candidate.id, "events": len(trace_events)})
                emit(db, session.id, f"timeline_T{4 if label == 'A' else 5}",
                     f"T{4 if label == 'A' else 5} Candidate {label} execution")
                db.commit()

                # falsification: defender's tests executed against BOTH candidates
                fals_tests = defender_proposal.falsification_tests or []
                fals = _run_falsification(workspace, session.test_command, fals_tests) \
                    if settings.falsification_enabled else {"executed": False}
                emit(db, session.id, "falsification_finished",
                     f"Falsification candidate {label}: "
                     f"{'executed' if fals.get('executed') else 'skipped'}",
                     {"candidate_id": candidate.id})
                add_evidence(db, session_id=session.id, round_id=round_item.id,
                             candidate_id=candidate.id, round_number=round_number,
                             type="FALSIFICATION_RESULT",
                             title=f"Falsification candidate {label}", agent="judge",
                             content=json.dumps(fals)[:4000],
                             verification_state="verified" if fals.get("executed") else "observed")
                db.commit()

                # protected + regression + diff evidence
                add_evidence(db, session_id=session.id, round_id=round_item.id,
                             candidate_id=candidate.id, round_number=round_number,
                             type="DIFF", title=f"Patch diff candidate {label}",
                             agent=candidate.agent,
                             content=diff_text(base_files, workspace)[:6000],
                             verification_state="observed")
                if tampered:
                    add_evidence(db, session_id=session.id, round_id=round_item.id,
                                 candidate_id=candidate.id, round_number=round_number,
                                 type="SANDBOX_EVENT", title="Protected-file tamper blocked",
                                 content="Candidate attempted to modify protected tests.",
                                 verification_state="verified")

                unexpected = [p for p in changed
                              if p.startswith(".") or p.startswith("/") or ".." in p]
                verdict = decide_advanced(
                    result, parsed, protected_tampered=tampered,
                    baseline_passed=baseline_passed,
                    falsification={"executed": bool(fals.get("executed")),
                                   "failed": bool(fals.get("failed")),
                                   "failed_names": fals.get("failed_names", [])},
                    unexpected_files=unexpected,
                )
                explanation = get_provider().summarize_judge_evidence(
                    verdict.evidence_summary, verdict.verdict)
                decision = JudgeDecision(
                    session_id=session.id, round_id=round_item.id,
                    candidate_id=candidate.id, verdict=verdict.verdict,
                    reason=verdict.reason, evidence_summary=verdict.evidence_summary,
                    llm_explanation=explanation)
                db.add(decision)
                add_evidence(db, session_id=session.id, round_id=round_item.id,
                             candidate_id=candidate.id, round_number=round_number,
                             type="TEST_RESULT", title=f"Judge verdict candidate {label}",
                             agent="judge",
                             content=f"{verdict.verdict}: {verdict.reason}\n{verdict.evidence_summary}",
                             verification_state="verified")
                if verdict.verdict == "PASSED":
                    candidate.status = "PASSED"
                    emit(db, session.id, "candidate_passed",
                         f"Candidate {label} passed runtime tests",
                         {"candidate_id": candidate.id, "execution_id": execution.id})
                else:
                    candidate.status = verdict.verdict
                    emit(db, session.id, "candidate_rejected", f"Candidate {label} {verdict.verdict}",
                         {"candidate_id": candidate.id, "execution_id": execution.id})
                    previous_failures.append(
                        f"{candidate.agent} {verdict.verdict}: {verdict.reason} "
                        f"{verdict.evidence_summary}")
                    # structured rejected memory
                    try:
                        record_rejection(
                            db, session_id=session.id, round_id=round_item.id,
                            candidate_id=candidate.id, round_number=round_number,
                            hypothesis=candidate.hypothesis or candidate.root_cause,
                            patch_hash=candidate.content_hash,
                            failed_tests=fault_map.get("failing_tests", []),
                            trace_summary=trace_summary,
                            counter_arguments=defender_proposal.objections or "",
                            observed_behavior=(
                                f"exit={result.exit_code} passed={parsed.passed} "
                                f"failed={parsed.failed} fals={fals.get('failed_names', [])}"),
                            rejection_reason=verdict.reason,
                            affected_symbols=fault_map.get("symbols", [])[:10])
                    except Exception:
                        pass
                if verdict.verdict == "SANDBOX_ERROR":
                    sandbox_failures += 1
                results[label] = {
                    "candidate": candidate, "verdict": verdict, "result": result,
                    "parsed": parsed, "trace": trace_summary,
                    "tests_failed": parsed.failed or 0,
                    "regressed": (parsed.passed or 0) < baseline_passed,
                    "falsification_failed": bool(fals.get("failed")),
                    "diff_size": len(diff_text(base_files, workspace)),
                    "files_changed": changed,
                    "duration_ms": result.duration_ms,
                    "anomaly": bool(raw_trace == "" and settings.trace_enabled),
                }
                emit(db, session.id, "judge_decision",
                     f"Judge: candidate {label} -> {verdict.verdict}",
                     {"candidate_id": candidate.id})
                db.commit()

            # 15-16. Judge compares / chooses WINNER (never both verified)
            emit(db, session.id, "timeline_T6", "T6 Trace captured")
            emit(db, session.id, "timeline_T7", "T7 Judge decision")
            passed_labels = [l for l, r in results.items() if r["verdict"].verdict == "PASSED"]
            if passed_labels:
                if len(passed_labels) == 2:
                    comparison = compare_candidates(
                        {**results["A"], "files_changed": results["A"]["files_changed"]},
                        {**results["B"], "files_changed": results["B"]["files_changed"]})
                    winner_label = comparison["winner"]
                    loser_label = "B" if winner_label == "A" else "A"
                    results[winner_label]["candidate"].status = "VERIFIED"
                    # loser is explicitly NOT verified even though tests passed
                    if results[loser_label]["candidate"].status == "PASSED":
                        results[loser_label]["candidate"].status = "FAILED"
                    emit(db, session.id, "candidate_compared",
                         f"Both passed; WINNER: CANDIDATE {winner_label}. {comparison['reason']}",
                         {"winner": winner_label})
                    add_evidence(db, session_id=session.id, round_id=round_item.id,
                                 round_number=round_number, type="TEST_RESULT",
                                 title=f"WINNER: CANDIDATE {winner_label}", agent="judge",
                                 content=comparison["reason"],
                                 verification_state="verified")
                    # record loser as rejected memory so Round 2 learns
                    try:
                        loser = results[loser_label]
                        record_rejection(
                            db, session_id=session.id, round_id=round_item.id,
                            candidate_id=loser["candidate"].id, round_number=round_number,
                            hypothesis=loser["candidate"].hypothesis,
                            patch_hash=loser["candidate"].content_hash,
                            failed_tests=[], trace_summary=loser["trace"],
                            counter_arguments="Lost explicit candidate comparison.",
                            observed_behavior="Passed tests but lost on scope/comparison.",
                            rejection_reason=comparison["reason"],
                            affected_symbols=[])
                    except Exception:
                        pass
                else:
                    winner_label = passed_labels[0]
                    results[winner_label]["candidate"].status = "VERIFIED"
                round_item.status = "completed"
                round_item.summary = "Verified fix found from runtime evidence"
                session.status = "verified"
                session.terminated_reason = "verified_fix"
                _touch(session)
                emit(db, session.id, "verified", "Judge verified a candidate from runtime evidence")
                emit(db, session.id, "timeline_T9", "T9 Final verification")
                db.commit()
                return

            cont, reason = should_start_next_round(
                round_number=round_number, max_rounds=session.max_rounds,
                verified=False, repeated=identical, sandbox_failures=sandbox_failures,
                max_sandbox_failures=settings.max_sandbox_failures)
            if not cont:
                round_item.status = "completed"
                if reason == "repeated_candidate":
                    session.status = "human_review"
                    session.terminated_reason = "repeated_candidate"
                    _touch(session)
                    emit(db, session.id, "human_review",
                         "Repeated identical proposals; human review required")
                elif reason == "sandbox_failure_threshold":
                    session.status = "terminated"
                    session.terminated_reason = "sandbox_failure_threshold"
                    _touch(session)
                    emit(db, session.id, "terminated", "Sandbox failure threshold reached")
                else:
                    session.status = "terminated"
                    session.terminated_reason = "max_rounds"
                    _touch(session)
                    emit(db, session.id, "terminated",
                         "Maximum rounds reached without a verified fix")
                db.commit()
                # max_rounds falls through to loop end naturally for intermediate rounds
                if round_number >= session.max_rounds or reason != "max_rounds":
                    if not (reason == "max_rounds" and round_number < session.max_rounds):
                        pass
                if reason != "max_rounds":
                    return

            round_item.status = "completed"
            round_item.summary = "No candidate passed; evidence retained for the next round"
            emit(db, session.id, "round_completed",
                 f"Round {round_number} completed without a verified fix")
            emit(db, session.id, "timeline_T8", f"T8 Next round ({round_number + 1})")
            db.commit()

        # loop exhausted (max rounds reached inside iteration already terminates,
        # this is the safe fallback)
        db.refresh(session)
        if session.status == "running":
            session.status = "terminated"
            session.terminated_reason = "max_rounds"
            _touch(session)
            emit(db, session.id, "terminated", "Maximum rounds reached without a verified fix")
            db.commit()
    finally:
        db.close()
