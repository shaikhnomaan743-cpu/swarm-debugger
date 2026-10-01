export type HealthResponse = {
  status: string;
  service: string;
};

export type User = {
  id: string;
  email: string;
  username: string;
};

export type ApiErrorBody = {
  detail?:
    | string
    | {
        error?: string;
        message?: string;
      }
    | Array<{ msg?: string; message?: string }>;
};

export type FileInput = {
  path: string;
  content: string;
};

export type FileOut = {
  id: string;
  path: string;
  content: string;
  kind: string;
  protected: boolean;
};

export type ExecutionOut = {
  id: string;
  session_id: string;
  round_id: string | null;
  candidate_id: string | null;
  kind: string;
  status: string;
  exit_code: number | null;
  duration_ms: number;
  stdout: string;
  stderr: string;
  tests_total: number | null;
  tests_passed: number | null;
  tests_failed: number | null;
  timed_out: boolean;
  protected_files_tampered: boolean;
  sandbox_backend: string;
  failure_summary: string | null;
  created_at: string;
};

export type CandidateOut = {
  id: string;
  session_id: string;
  round_id: string;
  agent: string;
  root_cause: string;
  hypothesis: string;
  patch_summary: string;
  files: FileInput[];
  files_changed: string[];
  expected_result: string;
  expected_tests: string[];
  objections: string;
  falsification_tests: string;
  status: string;
  demo_mode: boolean;
  created_at: string;
};

export type JudgeDecisionOut = {
  id: string;
  session_id: string;
  round_id: string;
  candidate_id: string;
  verdict: string;
  reason: string;
  evidence_summary: string;
  llm_explanation: string;
  created_at: string;
};

export type AgentMessageOut = {
  id: string;
  session_id: string;
  round_id: string | null;
  agent: string;
  role: string;
  content: string;
  created_at: string;
};

export type SessionEventOut = {
  id: string;
  session_id: string;
  type: string;
  message: string;
  created_at: string;
};

export type RoundOut = {
  id: string;
  session_id: string;
  number: number;
  status: string;
  summary: string | null;
  created_at: string;
  candidates: CandidateOut[];
  decisions: JudgeDecisionOut[];
};

export type SessionSummary = {
  id: string;
  project_name: string;
  language: string;
  status: string;
  current_round: number;
  max_rounds: number;
  demo_mode: boolean;
  terminated_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionDetail = SessionSummary & {
  description: string;
  test_command: string;
  entry_point: string;
  last_error: string | null;
  files: FileOut[];
  rounds: RoundOut[];
  executions: ExecutionOut[];
  messages: AgentMessageOut[];
  events: SessionEventOut[];
};

export type DashboardMetrics = {
  active_sessions: number;
  verified_fixes: number;
  failed_candidates: number;
  average_rounds: number;
};

export type SystemStatus = {
  sandbox_backend: string;
  sandbox_available: boolean;
  docker_available: boolean;
  queue_depth: number;
  timeout_seconds: number;
  memory_mb: number;
  cpu_limit: number;
  llm_mode: string;
  llm_model: string;
  max_debug_rounds: number;
  isolation_note: string;
};

export type SessionCreateRequest = {
  project_name: string;
  language?: string;
  description?: string;
  test_command?: string;
  entry_point?: string;
  files?: FileInput[];
  use_demo_fixture?: boolean;
  max_rounds?: number | null;
};
