"""Causal debugging graph backed by session data."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.extended import CausalEdge


def add_edge(db: Session, *, session_id: str, round_id: str | None,
             from_node: str, from_type: str, to_node: str, to_type: str,
             relation: str = "leads_to") -> CausalEdge:
    edge = CausalEdge(
        session_id=session_id, round_id=round_id,
        from_node=from_node[:200], from_type=from_type,
        to_node=to_node[:200], to_type=to_type,
        relation=relation, created_at=utcnow(),
    )
    db.add(edge)
    db.flush()
    return edge


def challenge_edge(db: Session, edge_id: str, note: str) -> CausalEdge | None:
    edge = db.get(CausalEdge, edge_id)
    if edge is None:
        return None
    edge.challenged = True
    edge.challenge_note = note[:2000]
    db.flush()
    return edge


def build_round_chain(db: Session, *, session_id: str, round_id: str,
                      failing_test: str, fault_file: str, hypothesis: str,
                      patch: str, expected: str) -> list[CausalEdge]:
    nodes = [
        ("FAILURE", "failure", failing_test, "test", "manifests_as"),
        (failing_test, "test", fault_file, "location", "points_to"),
        (fault_file, "location", hypothesis, "hypothesis", "explained_by"),
        (hypothesis, "hypothesis", patch, "patch", "proposes"),
        (patch, "patch", expected, "expected", "predicts"),
    ]
    edges = []
    for frm, ftype, to, ttype, rel in nodes:
        edges.append(add_edge(db, session_id=session_id, round_id=round_id,
                              from_node=frm, from_type=ftype,
                              to_node=to, to_type=ttype, relation=rel))
    return edges
