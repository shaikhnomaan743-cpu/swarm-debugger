from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.db.base import Base


class JudgeDecision(Base):
    __tablename__ = "judge_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    round_id: Mapped[str] = mapped_column(ForeignKey("rounds.id"), nullable=False, index=True)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    verdict: Mapped[str] = mapped_column(String(40), nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    evidence_summary: Mapped[str] = mapped_column(Text, default="")
    llm_explanation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    session: Mapped["DebugSession"] = relationship(back_populates="decisions")
    round: Mapped["DebugRound"] = relationship(back_populates="decisions")
    candidate: Mapped["Candidate"] = relationship(back_populates="decisions")
