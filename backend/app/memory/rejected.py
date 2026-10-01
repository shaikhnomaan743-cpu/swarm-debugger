"""Rejected-hypothesis memory with duplicate detection."""
from __future__ import annotations

import hashlib
import json
import re
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.extended import RejectedHypothesis


def _normalize(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def hypothesis_fingerprint(hypothesis: str, patch_hash: str) -> str:
    return hashlib.sha256(f"{_normalize(hypothesis)}|{patch_hash}".encode()).hexdigest()


def record_rejection(db: Session, *, session_id: str, round_id: str | None,
                     candidate_id: str | None, round_number: int,
                     hypothesis: str, patch_hash: str,
                     failed_tests: list[str], trace_summary: str,
                     counter_arguments: str, observed_behavior: str,
                     rejection_reason: str,
                     affected_symbols: list[str]) -> RejectedHypothesis:
    # duplicate detection: same fingerprint seen before in this session
    fp = hypothesis_fingerprint(hypothesis, patch_hash)
    prior = db.query(RejectedHypothesis).filter(
        RejectedHypothesis.session_id == session_id).all()
    repeated = any(
        hypothesis_fingerprint(p.hypothesis, p.patch_hash) == fp for p in prior
    )
    item = RejectedHypothesis(
        session_id=session_id, round_id=round_id, candidate_id=candidate_id,
        round_number=round_number, hypothesis=hypothesis[:4000],
        patch_hash=patch_hash,
        failed_tests_json=json.dumps(failed_tests),
        trace_summary=trace_summary[:4000],
        counter_arguments=counter_arguments[:4000],
        observed_behavior=observed_behavior[:4000],
        rejection_reason=rejection_reason[:4000],
        affected_symbols_json=json.dumps(affected_symbols),
        repeated=repeated, created_at=utcnow(),
    )
    db.add(item)
    db.flush()
    return item


def is_repeated(db: Session, *, session_id: str, hypothesis: str, patch_hash: str) -> bool:
    fp = hypothesis_fingerprint(hypothesis, patch_hash)
    prior = db.query(RejectedHypothesis).filter(
        RejectedHypothesis.session_id == session_id).all()
    return any(hypothesis_fingerprint(p.hypothesis, p.patch_hash) == fp for p in prior)


def memory_context(db: Session, session_id: str, limit: int = 5) -> list[str]:
    items = (db.query(RejectedHypothesis)
             .filter(RejectedHypothesis.session_id == session_id)
             .order_by(RejectedHypothesis.created_at.desc())
             .limit(limit).all())
    lines = []
    for item in items:
        lines.append(
            f"R{item.round_number} rejected: {item.hypothesis[:160]} "
            f"| reason: {item.rejection_reason[:160]} "
            f"| observed: {item.observed_behavior[:160]}"
        )
    return list(reversed(lines))
