from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.db.base import Base


class DebugRound(Base):
    __tablename__ = "rounds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("debug_sessions.id"), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    session: Mapped["DebugSession"] = relationship(back_populates="rounds")
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="round")
    executions: Mapped[list["Execution"]] = relationship(back_populates="round")
    messages: Mapped[list["AgentMessage"]] = relationship(back_populates="round")
    decisions: Mapped[list["JudgeDecision"]] = relationship(back_populates="round")
