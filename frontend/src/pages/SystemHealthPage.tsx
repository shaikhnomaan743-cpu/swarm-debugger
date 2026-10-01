import { useEffect, useState } from "react";
import { getMetrics } from "../services/extended";
import { getSystemStatus } from "../services/api";
import type { Metrics } from "../types/extended";
import type { SystemStatus } from "../types";

export function SystemHealthPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [system, setSystem] = useState<SystemStatus | null>(null);

  useEffect(() => {
    getMetrics().then(setMetrics).catch(() => undefined);
    getSystemStatus().then(setSystem).catch(() => undefined);
  }, []);

  const cards = metrics
    ? [
      { label: "Active sessions", value: metrics.active_sessions },
      { label: "Verified fixes", value: metrics.verified_fixes },
      { label: "Rejected patches", value: metrics.rejected_patches },
      { label: "Avg rounds", value: metrics.average_rounds },
      { label: "Agent disagreements", value: metrics.agent_disagreements },
      { label: "Repeated hypotheses", value: metrics.repeated_hypotheses },
      { label: "Trace events", value: metrics.trace_events },
      { label: "Evidence items", value: metrics.evidence_items },
    ]
    : [];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">System Health</h1>
      <p className="text-sm text-muted">Real system metrics from stored sessions — never random values.</p>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <article key={c.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase text-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          </article>
        ))}
      </section>
      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">Judge verdicts</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          {metrics ? JSON.stringify(metrics.judge_verdicts) : "—"}
        </p>
        <h2 className="mt-4 font-semibold">Runtime</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          LLM {system?.llm_mode}/{system?.llm_model} · sandbox {system?.sandbox_backend} ·
          timeout {system?.timeout_seconds}s · {system?.memory_mb}MB
        </p>
      </section>
    </main>
  );
}
