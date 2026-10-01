import { Suspense, lazy, useEffect, useState } from "react";
import { challengeEdge, getCausal, getMemory } from "../services/extended";
import type { CausalEdge, RejectedMemory } from "../types/extended";
import { SessionPicker, useSessionOptions } from "./_shared";

const KnowledgeGraph3D = lazy(() =>
  import("../components/three/KnowledgeGraph3D").then((m) => ({ default: m.KnowledgeGraph3D })),
);

export function CausalGraphPage() {
  const { sessions, selected, setSelected } = useSessionOptions();
  const [edges, setEdges] = useState<CausalEdge[]>([]);
  const [memory, setMemory] = useState<RejectedMemory[]>([]);

  useEffect(() => {
    if (!selected) return;
    getCausal(selected).then(setEdges).catch(() => setEdges([]));
    getMemory(selected).then(setMemory).catch(() => setMemory([]));
  }, [selected]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Causal Graph</h1>
          <p className="text-sm text-muted">Failure → test → location → hypothesis → patch → verification. Defender can attack any link.</p>
        </div>
        <SessionPicker sessions={sessions} selected={selected} onChange={setSelected} />
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <Suspense fallback={<p className="text-sm text-muted">Loading graph…</p>}>
          <KnowledgeGraph3D edges={edges} />
        </Suspense>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Challenge a link</h2>
        {edges.length === 0 ? (
          <p className="text-sm text-muted">No edges yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-xs">
            {edges.slice(0, 10).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
                <span className="font-mono">{e.from} → {e.to}</span>
                {e.challenged ? (
                  <span className="text-danger">CHALLENGED</span>
                ) : (
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 hover:bg-surface-2"
                    onClick={() => {
                      const note = window.prompt("Challenge note (which link is unsupported)?") ?? "";
                      if (note) void challengeEdge(selected, e.id, note).then(() => getCausal(selected).then(setEdges));
                    }}
                  >
                    Challenge
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Rejected-hypothesis memory ({memory.length})</h2>
        {memory.map((m) => (
          <article key={m.id} className="mb-2 rounded border border-border bg-surface-2 p-3 text-xs">
            <p className="font-mono text-muted">R{m.round} {m.repeated ? "· REPEATED HYPOTHESIS" : ""}</p>
            <p className="mt-1 font-semibold">{m.hypothesis.slice(0, 200)}</p>
            <p className="mt-1 text-muted">Reason: {m.rejection_reason.slice(0, 200)}</p>
            <p className="mt-1 font-mono text-muted">Observed: {m.observed_behavior.slice(0, 200)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
