from __future__ import annotations

from dataclasses import dataclass, field

from pydantic import BaseModel, Field


class PatchFile(BaseModel):
    path: str
    content: str


class AgentProposal(BaseModel):
    root_cause: str
    hypothesis: str
    evidence: list[str] = Field(default_factory=list)
    files: list[PatchFile]
    files_changed: list[str] = Field(default_factory=list)
    expected_behavior: str = ""
    expected_tests: list[str] = Field(default_factory=list)
    objections: str = ""
    assumptions: list[str] = Field(default_factory=list)
    falsification_tests: list[str] = Field(default_factory=list)
    patch_summary: str = ""
    demo_mode: bool = True
    verified: bool = False
    # Prosecutor structured extras
    validation_plan: str = ""
    # Defender structured extras
    alternative_hypothesis: str = ""
    alternative_root_cause: str = ""
    evidence_needed: list[str] = Field(default_factory=list)


class DebugContext(BaseModel):
    project_name: str
    language: str
    description: str
    test_command: str
    files: dict[str, str]
    baseline_stdout: str = ""
    baseline_stderr: str = ""
    baseline_exit_code: int | None = None
    previous_failures: list[str] = Field(default_factory=list)
    prosecutor_proposal: AgentProposal | None = None
    round_number: int = 1
    fault_map: dict = Field(default_factory=dict)
    rejected_memory: list[str] = Field(default_factory=list)


@dataclass
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    timed_out: bool
    backend: str
    error: str | None = None
    extra: dict[str, str] = field(default_factory=dict)
