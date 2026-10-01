import { useEffect, useState } from "react";
import { getBenchmarkCases, getBenchmarkComparison, runBenchmarks } from "../services/extended";
import type { BenchmarkCase, BenchmarkComparison } from "../types/extended";

const MODE_NAMES: Record<string, string> = {
  A: "Single Agent", B: "Prosecutor + Judge", C: "Prosecutor + Defender + Judge",
  D: "Full Swarm Debugger", E: "Full Swarm + Runtime Trace",
};

export function BenchmarkLabPage() {
  const [cases, setCases] = useState<BenchmarkCase[]>([]);
  const [comparison, setComparison] = useState<BenchmarkComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBenchmarkCases().then(setCases).catch(() => undefined);
    getBenchmarkComparison().then(setComparison).catch(() => undefined);
  }, []);

  async function onRun(caseSlug?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await runBenchmarks(caseSlug);
      setComparison(res.comparison);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Benchmark run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Benchmark Lab</h1>
          <p className="text-sm text-muted">Compare debugging strategies on controlled bugs. Numbers are measured, never fabricated.</p>
        </div>
        <button
          type="button" disabled={busy} onClick={() => void onRun()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Running…" : "Run all modes × all cases"}
        </button>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Modes A–E vs cases</h2>
        {!comparison || !comparison.measured ? (
          <p className="rounded border border-border bg-surface-2 p-3 font-mono text-xs text-muted">
            NOT YET MEASURED — run the benchmark to populate fix rate, rounds, runtime, and evidence metrics.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Fix rate</th>
                  <th className="px-3 py-2">Avg rounds</th>
                  <th className="px-3 py-2">Avg runtime</th>
                  <th className="px-3 py-2">Avg evidence</th>
                  <th className="px-3 py-2">Repeated hyp.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(comparison.modes ?? {}).map(([mode, row]) => (
                  <tr key={mode} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{mode} · {MODE_NAMES[mode]}</td>
                    {row.measured ? (
                      <>
                        <td className="px-3 py-2 tabular-nums">{(row.fix_success_rate * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 tabular-nums">{row.avg_rounds}</td>
                        <td className="px-3 py-2 tabular-nums">{row.avg_runtime_ms}ms</td>
                        <td className="px-3 py-2 tabular-nums">{row.avg_evidence}</td>
                        <td className="px-3 py-2 tabular-nums">{(row.repeated_hypothesis_rate * 100).toFixed(1)}%</td>
                      </>
                    ) : (
                      <td colSpan={5} className="px-3 py-2 font-mono text-muted">NOT YET MEASURED</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cases.map((c) => (
          <article key={c.id} className="rounded-lg border border-border bg-surface p-4">
            <p className="font-mono text-[11px] text-muted">{c.category} · {c.difficulty}</p>
            <h3 className="mt-1 text-sm font-semibold">{c.title}</h3>
            <p className="mt-1 text-xs text-muted">{c.description}</p>
            <p className="mt-1 font-mono text-[11px] text-muted">Expected: {c.expected_behavior}</p>
            <button
              type="button" disabled={busy} onClick={() => void onRun(c.slug)}
              className="mt-3 rounded border border-border px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
            >
              Run {c.slug}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
