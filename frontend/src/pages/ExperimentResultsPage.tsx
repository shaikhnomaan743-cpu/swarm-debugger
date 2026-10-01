import { useEffect, useState } from "react";
import { listExperiments } from "../services/extended";
import type { ExperimentSummary } from "../types/extended";

export function ExperimentResultsPage() {
  const [items, setItems] = useState<ExperimentSummary[]>([]);

  useEffect(() => {
    listExperiments().then(setItems).catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">Experiment Results</h1>
      <p className="text-sm text-muted">Comparison tables, metrics, run logs, failure cases, and repeated hypotheses.</p>
      {items.length === 0 ? (
        <p className="rounded border border-border bg-surface p-4 font-mono text-xs text-muted">
          NOT YET MEASURED — no experiments have been run.
        </p>
      ) : (
        items.map((e) => (
          <article key={e.id} className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">{e.name}</h2>
            <p className="font-mono text-[11px] text-muted">{e.status} · dataset {e.dataset.join(", ") || "all"}</p>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-surface-2 p-3 font-mono text-[11px] text-muted">
              {JSON.stringify(e.result, null, 2).slice(0, 6000)}
            </pre>
          </article>
        ))
      )}
    </main>
  );
}
