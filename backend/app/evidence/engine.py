"""Unified Evidence Engine. Every debugging claim links to evidence."""
from __future__ import annotations

import json
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.extended import EvidenceItem

EVIDENCE_TYPES = [
    "TEST_RESULT", "STACK_TRACE", "STDOUT", "STDERR", "EXIT_CODE",
    "RUNTIME_TRACE", "VARIABLE_STATE", "DIFF", "FAULT_LOCATION",
    "HYPOTHESIS", "COUNTER_ARGUMENT", "FALSIFICATION_RESULT",
    "SANDBOX_EVENT", "BASELINE_RESULT", "REGRESSION_RESULT",
]


def add_evidence(db: Session, *, session_id: str, type: str,
                 title: str = "", content: str = "", source: str = "system",
                 agent: str = "", round_id: str | None = None,
                 candidate_id: str | None = None, round_number: int = 0,
                 verification_state: str = "observed") -> EvidenceItem:
    if type not in EVIDENCE_TYPES:
        type = "TEST_RESULT"
    item = EvidenceItem(
        session_id=session_id, round_id=round_id, candidate_id=candidate_id,
        round_number=round_number, source=source, type=type, agent=agent,
        title=title[:300], content=content[:20000],
        verification_state=verification_state, created_at=utcnow(),
    )
    db.add(item)
    db.flush()
    return item


def list_evidence(db: Session, session_id: str, *, type: str | None = None,
                  round_id: str | None = None) -> list[EvidenceItem]:
    query = db.query(EvidenceItem).filter(EvidenceItem.session_id == session_id)
    if type:
        query = query.filter(EvidenceItem.type == type)
    if round_id:
        query = query.filter(EvidenceItem.round_id == round_id)
    return query.order_by(EvidenceItem.created_at).all()


def evidence_to_dict(item: EvidenceItem) -> dict:
    return {
        "id": item.id, "session_id": item.session_id, "round_id": item.round_id,
        "candidate_id": item.candidate_id, "round": item.round_number,
        "source": item.source, "type": item.type, "agent": item.agent,
        "title": item.title, "content": item.content,
        "verification_state": item.verification_state,
        "created_at": item.created_at.isoformat() if item.created_at else "",
    }


def diff_text(before: dict[str, str], after: dict[str, str]) -> str:
    import difflib
    chunks: list[str] = []
    for path in sorted(set(before) | set(after)):
        old = before.get(path, "").splitlines()
        new = after.get(path, "").splitlines()
        if old == new:
            continue
        chunks.append(f"--- {path}")
        chunks.extend(difflib.unified_diff(old, new, lineterm="", n=3))
    return "\n".join(chunks)[:8000] or "no changes"
