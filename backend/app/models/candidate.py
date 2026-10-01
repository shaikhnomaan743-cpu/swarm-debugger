from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.db.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str] = mapped_column(ForeignKey("rounds.id"), nullable=False, index=True)
    agent: Mapped[str] = mapped_column(String(20), nullable=False)
    root_cause: Mapped[str] = mapped_column(Text, default="")
    hypothesis: Mapped[str] = mapped_column(Text, default="")
    patch_summary: Mapped[str] = mapped_column(Text, default="")
    files_json: Mapped[str] = mapped_column(Text, default="[]")
    files_changed_json: Mapped[str] = mapped_column(Text, default="[]")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    expected_tests_json: Mapped[str] = mapped_column(Text, default="[]")
    objections: Mapped[str] = mapped_column(Text, default="")
    falsification_tests: Mapped[str] = mapped_column(Text, default="")
    content_hash: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="PROPOSED")
    demo_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    session: Mapped["DebugSession"] = relationship(back_populates="candidates")
    round: Mapped["DebugRound"] = relationship(back_populates="candidates")
    executions: Mapped[list["Execution"]] = relationship(back_populates="candidate")
    decisions: Mapped[list["JudgeDecision"]] = relationship(back_populates="candidate")
