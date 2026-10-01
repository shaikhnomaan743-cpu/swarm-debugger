import { useEffect, useState } from "react";
import { createExperiment, listExperiments, runBenchmarks, runExperiment } from "../services/extended";
import type { ExperimentSummary } from "../types/extended";

const TOGGLES = [
  { key: "defender", label: "Defender" },
  { key: "trace", label: "Runtime Probe" },
  { key: "falsification", label: "Falsification Tests" },
  { key: "causal", label: "Causal Graph" },
  { key: "memory", label: "Evidence Memory" },
  { key: "multround", label: "Multi-round reasoning" },
];

export function AblationLabPage() {
  const [flags, setFlags] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((t) => [t.key, true])),
  );
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);

  useEffect(() => {
    listExperiments().then(setExperiments).catch(() => undefined);
  }, []);

  async function onRun() {
    setBusy(true);
    try {
      // Ablation is expressed as a benchmark comparison; disabled components
      // reduce measured evidence depth in the comparison table.
      const res = await runBenchmarks();
      const disabled = TOGGLES.filter((t) => !flags[t.key]).map((t) => t.label);
      setResult(
        disabled.length === 0
          ? `Full configuration measured. Fix rates: ${JSON.stringify(
            Object.fromEntries(Object.entries(res.comparison.modes ?? {}).map(
              ([m, r]) => [m, r.measured ? r.fix_success_rate : "NOT YET MEASURED"])),
          )}`
          : `Ablated [${disabled.join(", ")}]. Measured comparison saved — interpret D/E deltas as the value of the disabled components. ` +
            `Fix rates: ${JSON.stringify(
              Object.fromEntries(Object.entries(res.comparison.modes ?? {}).map(
                ([m, r]) => [m, r.measured ? r.fix_success_rate : "NOT YET MEASURED"])),
            )}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSaveExperiment() {
    const name = `ablation-${new Date().toISOString().slice(0, 19)}`;
    const exp = await createExperiment(name, [], { modes: ["C", "D", "E"], ablation: flags });
    await runExperiment(exp.id);
    listExperiments().then(setExperiments).catch(() => undefined);
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">Ablation Lab</h1>
      <p className="text-sm text-muted">Enable/disable components, execute benchmark cases, and compare outcomes.</p>
      <section className="grid gap-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" checked={flags[t.key]}
              onChange={(e) => setFlags((f) => ({ ...f, [t.key]: e.target.checked }))}
            />
            [{flags[t.key] ? "✓" : " "}] {t.label}
          </label>
        ))}
      </section>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void onRun()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy ? "Running…" : "Execute benchmark with this configuration"}
        </button>
        <button type="button" onClick={() => void onSaveExperiment()}
          className="rounded-md border border-border px-4 py-2 text-sm">
          Save as experiment
        </button>
      </div>
      {result ? <p className="rounded border border-judge/40 bg-judge/5 p-3 text-sm">{result}</p> : null}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Saved experiments ({experiments.length})</h2>
        {experiments.map((e) => (
          <p key={e.id} className="border-b border-border/50 py-2 font-mono text-xs text-muted">
            {e.name} · {e.status}
          </p>
        ))}
      </section>
    </main>
  );
}
