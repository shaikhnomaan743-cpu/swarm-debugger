import { Suspense, lazy, useEffect, useState } from "react";
import { getSession } from "../services/api";
import { getTraces } from "../services/extended";
import type { SessionDetail } from "../types";
import type { TracePoint } from "../types/extended";
import { SessionPicker, useSessionOptions } from "./_shared";

const TraceVisualizer3D = lazy(() =>
  import("../components/three/TraceVisualizer3D").then((m) => ({ default: m.TraceVisualizer3D })),
);

export function TracePage() {
  const { sessions, selected, setSelected } = useSessionOptions();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<TracePoint[]>([]);
  const [candidate, setCandidate] = useState("");

  useEffect(() => {
    if (!selected) return;
    getSession(selected).then(setSession).catch(() => undefined);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    getTraces(selected, candidate || undefined).then(setEvents).catch(() => setEvents([]));
  }, [selected, candidate]);

  const candidates = session?.rounds.flatMap((r) => r.candidates) ?? [];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Runtime Trace</h1>
          <p className="text-sm text-muted">Structured probe records: entry/exit, exceptions, variable state.</p>
        </div>
        <div className="flex gap-2">
          <SessionPicker sessions={sessions} selected={selected} onChange={setSelected} />
          <select
            value={candidate} onChange={(e) => setCandidate(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1.5 text-sm" aria-label="Filter by candidate"
          >
            <option value="">all candidates</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.agent} — {c.status}</option>
            ))}
          </select>
        </div>
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <Suspense fallback={<p className="text-sm text-muted">Loading trace…</p>}>
          <TraceVisualizer3D events={events} />
        </Suspense>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Trace events ({events.length})</h2>
        <ul className="max-h-64 overflow-auto font-mono text-[11px] text-muted">
          {events.slice(0, 100).map((e) => (
            <li key={e.id} className="border-b border-border/50 py-1">
              #{e.seq} {e.kind} {e.function} @ {e.file}:{e.line ?? "?"} — {e.note.slice(0, 120)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
