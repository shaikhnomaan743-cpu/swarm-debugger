import { useEffect, useState } from "react";
import { getSandboxMonitor, getMetrics } from "../services/extended";
import type { Metrics } from "../types/extended";

export function SandboxMonitorPage() {
  const [monitor, setMonitor] = useState<{ backend: string; docker_available: boolean; queue_depth: number; isolation_note: string; strict: boolean } | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    getSandboxMonitor().then(setMonitor).catch(() => undefined);
    getMetrics().then(setMetrics).catch(() => undefined);
    const t = window.setInterval(() => {
      getSandboxMonitor().then(setMonitor).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">Sandbox Monitor</h1>
      <p className="text-sm text-muted">Isolation, queue, executions, errors. Security status is always visible.</p>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Backend", value: monitor?.backend ?? "—" },
          { label: "Docker", value: monitor ? (monitor.docker_available ? "available" : "unavailable") : "—" },
          { label: "Queue depth", value: monitor?.queue_depth ?? "—" },
          { label: "Executions", value: metrics?.executions ?? "—" },
        ].map((c) => (
          <article key={c.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase text-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          </article>
        ))}
      </section>
      <p className="rounded border border-border bg-surface p-3 font-mono text-[11px] text-muted">
        {monitor?.isolation_note ?? "Loading isolation status…"}
      </p>
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Sandbox errors", value: metrics?.sandbox_errors ?? "—" },
          { label: "Timeouts", value: metrics?.timeouts ?? "—" },
          { label: "Avg execution", value: metrics ? `${metrics.average_execution_ms}ms` : "—" },
        ].map((c) => (
          <article key={c.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase text-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
