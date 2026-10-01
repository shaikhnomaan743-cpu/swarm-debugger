import type {
  BenchmarkCase,
  BenchmarkComparison,
  CausalEdge,
  EvidenceItem,
  ExperimentSummary,
  FaultMap,
  Metrics,
  RejectedMemory,
  ToolCall,
  TracePoint,
} from "../types/extended";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const getEvidence = (id: string, type?: string) =>
  req<EvidenceItem[]>(`/api/sessions/${id}/evidence${type ? `?type=${type}` : ""}`);
export const getTraces = (id: string, candidateId?: string) =>
  req<TracePoint[]>(`/api/sessions/${id}/traces${candidateId ? `?candidate_id=${candidateId}` : ""}`);
export const getCausal = (id: string) => req<CausalEdge[]>(`/api/sessions/${id}/causal`);
export const getMemory = (id: string) => req<RejectedMemory[]>(`/api/sessions/${id}/memory`);
export const getFaultMaps = (id: string) => req<FaultMap[]>(`/api/sessions/${id}/faultmaps`);
export const getToolCalls = (id: string) => req<ToolCall[]>(`/api/sessions/${id}/tools`);
export const getReplay = (id: string) =>
  req<{ id: string; type: string; message: string; payload: Record<string, unknown>; created_at: string }[]>(
    `/api/sessions/${id}/replay`,
  );
export const getMetrics = () => req<Metrics>("/api/metrics");
export const getSandboxMonitor = () =>
  req<{ backend: string; docker_available: boolean; queue_depth: number; isolation_note: string; strict: boolean }>(
    "/api/sandbox/monitor",
  );
export const getBenchmarkCases = () => req<BenchmarkCase[]>("/api/benchmarks/cases");
export const getBenchmarkComparison = () => req<BenchmarkComparison>("/api/benchmarks/comparison");
export const runBenchmarks = (case_slug?: string, modes?: string[]) =>
  req<{ runs: unknown[]; comparison: BenchmarkComparison }>("/api/benchmarks/run", {
    method: "POST",
    body: JSON.stringify({ case_slug, modes: modes ?? ["A", "B", "C", "D", "E"] }),
  });
export const listExperiments = () => req<ExperimentSummary[]>("/api/experiments");
export const createExperiment = (name: string, dataset: string[], config: Record<string, unknown>) =>
  req<{ id: string }>("/api/experiments", {
    method: "POST",
    body: JSON.stringify({ name, dataset, config }),
  });
export const runExperiment = (id: string) =>
  req<unknown>(`/api/experiments/${id}/run`, { method: "POST" });
export const challengeEdge = (sessionId: string, edgeId: string, note: string) =>
  req<{ status: string }>(`/api/sessions/${sessionId}/causal/${edgeId}/challenge`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
