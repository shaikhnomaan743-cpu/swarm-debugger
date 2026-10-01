from pydantic import BaseModel, ConfigDict, Field


class FileInput(BaseModel):
    path: str = Field(min_length=1, max_length=400)
    content: str = Field(max_length=200_000)


class SessionCreateRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    language: str = Field(default="python", max_length=40)
    description: str = Field(default="", max_length=4000)
    test_command: str = Field(default="pytest -q", max_length=200)
    entry_point: str = Field(default="solution.py", max_length=200)
    files: list[FileInput] = Field(default_factory=list)
    use_demo_fixture: bool = False
    max_rounds: int | None = Field(default=None, ge=1, le=10)


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    path: str
    content: str
    kind: str
    protected: bool


class ExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    round_id: str | None
    candidate_id: str | None
    kind: str
    status: str
    exit_code: int | None
    duration_ms: int
    stdout: str
    stderr: str
    tests_total: int | None
    tests_passed: int | None
    tests_failed: int | None
    timed_out: bool
    protected_files_tampered: bool
    sandbox_backend: str
    failure_summary: str | None
    created_at: str


class CandidateOut(BaseModel):
    id: str
    session_id: str
    round_id: str
    agent: str
    root_cause: str
    hypothesis: str
    patch_summary: str
    files: list[FileInput]
    files_changed: list[str]
    expected_result: str
    expected_tests: list[str]
    objections: str
    falsification_tests: str
    status: str
    demo_mode: bool
    created_at: str


class JudgeDecisionOut(BaseModel):
    id: str
    session_id: str
    round_id: str
    candidate_id: str
    verdict: str
    reason: str
    evidence_summary: str
    llm_explanation: str
    created_at: str


class AgentMessageOut(BaseModel):
    id: str
    session_id: str
    round_id: str | None
    agent: str
    role: str
    content: str
    created_at: str


class SessionEventOut(BaseModel):
    id: str
    session_id: str
    type: str
    message: str
    created_at: str


class RoundOut(BaseModel):
    id: str
    session_id: str
    number: int
    status: str
    summary: str | None
    created_at: str
    candidates: list[CandidateOut] = Field(default_factory=list)
    decisions: list[JudgeDecisionOut] = Field(default_factory=list)


class SessionSummary(BaseModel):
    id: str
    project_name: str
    language: str
    status: str
    current_round: int
    max_rounds: int
    demo_mode: bool
    terminated_reason: str | None
    created_at: str
    updated_at: str


class SessionDetail(SessionSummary):
    description: str
    test_command: str
    entry_point: str
    last_error: str | None
    files: list[FileOut]
    rounds: list[RoundOut]
    executions: list[ExecutionOut]
    messages: list[AgentMessageOut]
    events: list[SessionEventOut]


class DashboardMetrics(BaseModel):
    active_sessions: int
    verified_fixes: int
    failed_candidates: int
    average_rounds: float


class SystemStatus(BaseModel):
    sandbox_backend: str
    sandbox_available: bool
    docker_available: bool
    queue_depth: int
    timeout_seconds: int
    memory_mb: int
    cpu_limit: float
    llm_mode: str
    llm_model: str
    max_debug_rounds: int
    isolation_note: str
