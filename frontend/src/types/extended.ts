import type {
  CandidateOut,
  DashboardMetrics,
  ExecutionOut,
  SessionDetail,
  SessionSummary,
  SystemStatus,
} from "./index";

export type EvidenceItem = {
  id: string;
  session_id: string;
  round_id: string | null;
  candidate_id: string | null;
  round: number;
  source: string;
  type: string;
  agent: string;
  title: string;
  content: string;
  verification_state: string;
  created_at: string;
};

export type TracePoint = {
  id: string;
  seq: number;
  kind: string;
  function: string;
  file: string;
  line: number | null;
  variables: Record<string, string>;
  note: string;
  candidate_id: string | null;
  execution_id: string | null;
};

export type CausalEdge = {
  id: string;
  from: string;
  from_type: string;
  to: string;
  to_type: string;
  relation: string;
  challenged: boolean;
  challenge_note: string;
  round_id: string | null;
};

export type RejectedMemory = {
  id: string;
  round: number;
  hypothesis: string;
  patch_hash: string;
  failed_tests: string[];
  trace_summary: string;
  counter_arguments: string;
  observed_behavior: string;
  rejection_reason: string;
  affected_symbols: string[];
  repeated: boolean;
  candidate_id: string | null;
};

export type FaultMap = {
  round: number;
  files: string[];
  symbols: string[];
  failing_tests: string[];
  regions: { file: string; line: number; symbol: string }[];
  evidence: string[];
};

export type ToolCall = {
  id: string;
  agent: string;
  tool: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  created_at: string;
};

export type BenchmarkCase = {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  description: string;
  expected_behavior: string;
};

export type BenchmarkComparison = {
  measured: boolean;
  message?: string;
  modes?: Record<
    string,
    | { measured: false; message: string }
    | {
        measured: true;
        name: string;
        runs: number;
        fix_success_rate: number;
        avg_rounds: number;
        avg_runtime_ms: number;
        avg_evidence: number;
        repeated_hypothesis_rate: number;
      }
  >;
  cases?: { slug: string; title: string; category: string }[];
};

export type ExperimentSummary = {
  id: string;
  name: string;
  status: string;
  dataset: string[];
  config: Record<string, unknown>;
  result: Record<string, unknown>;
};

export type Metrics = {
  active_sessions: number;
  total_sessions: number;
  verified_fixes: number;
  rejected_patches: number;
  failed_candidates: number;
  average_rounds: number;
  average_execution_ms: number;
  executions: number;
  sandbox_errors: number;
  timeouts: number;
  repeated_hypotheses: number;
  agent_disagreements: number;
  trace_events: number;
  evidence_items: number;
  judge_verdicts: Record<string, number>;
};

export type { CandidateOut, DashboardMetrics, ExecutionOut, SessionDetail, SessionSummary, SystemStatus };
