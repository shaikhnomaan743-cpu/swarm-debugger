"""Experiments: named ablation/benchmark studies with saved results."""
from __future__ import annotations

import json
from sqlalchemy.orm import Session

from app.benchmark.library import MODES, comparison_table, run_case
from app.core.clock import utcnow
from app.models.extended import BenchmarkCase, Experiment


def create_experiment(db: Session, *, name: str, dataset: list[str],
                      config: dict) -> Experiment:
    exp = Experiment(name=name[:200], dataset_json=json.dumps(dataset),
                     config_json=json.dumps(config), status="created",
                     result_json="{}", created_at=utcnow())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


def run_experiment(db: Session, exp: Experiment) -> dict:
    dataset = json.loads(exp.dataset_json or "[]")
    config = json.loads(exp.config_json or "{}")
    modes = config.get("modes") or ["A", "B", "C", "D", "E"]
    cases = db.query(BenchmarkCase).all()
    if dataset:
        cases = [c for c in cases if c.slug in dataset]
    results: dict = {"modes": {}, "runs": []}
    for case in cases:
        for mode in modes:
            if mode not in MODES:
                continue
            run = run_case(db, case, mode)
            results["runs"].append({"case": case.slug, "mode": mode, "status": run.status,
                                    "duration_ms": run.duration_ms,
                                    "evidence": run.evidence_count, "trace": run.trace_events})
    table = comparison_table(db)
    exp.status = "completed"
    exp.result_json = json.dumps({"table": table, "runs": results["runs"]})
    db.commit()
    return {"experiment_id": exp.id, "table": table, "runs": results["runs"]}
