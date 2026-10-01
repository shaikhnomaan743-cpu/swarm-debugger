import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { getReplay } from "../services/extended";
import type { ReplayEvent } from "../components/three/Replay3D";
import { SessionPicker, useSessionOptions } from "./_shared";

const Replay3D = lazy(() =>
  import("../components/three/Replay3D").then((m) => ({ default: m.Replay3D })),
);

export function ReplayPage() {
  const { sessions, selected, setSelected } = useSessionOptions();
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!selected) return;
    getReplay(selected).then((e) => {
      setEvents(e);
      setIndex(e.length ? e.length - 1 : 0);
    }).catch(() => setEvents([]));
  }, [selected]);

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1 >= events.length ? 0 : i + 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, events.length]);

  const current = useMemo(() => events[index], [events, index]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Debug Replay — Time Machine</h1>
          <p className="text-sm text-muted">T0 Baseline → T9 Verification. Scrub the forensic reconstruction.</p>
        </div>
        <SessionPicker sessions={sessions} selected={selected} onChange={setSelected} />
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <Suspense fallback={<p className="text-sm text-muted">Loading replay…</p>}>
          <Replay3D events={events} index={index} />
        </Suspense>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button type="button" className="rounded border border-border px-3 py-1.5" onClick={() => setPlaying((v) => !v)} aria-pressed={playing}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="rounded border border-border px-3 py-1.5" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            ← Step
          </button>
          <button type="button" className="rounded border border-border px-3 py-1.5" onClick={() => setIndex((i) => Math.min(events.length - 1, i + 1))}>
            Step →
          </button>
          <input
            type="range" min={0} max={Math.max(0, events.length - 1)} value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="min-w-48 flex-1" aria-label="Replay timeline scrubber"
          />
          <span className="font-mono text-xs text-muted">{index + 1}/{events.length}</span>
        </div>
        {current ? (
          <p className="mt-2 text-sm">
            <span className="font-mono text-primary">{current.type}</span>
            <span className="ml-2 text-muted">{current.message}</span>
          </p>
        ) : null}
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Event timeline</h2>
        <ul className="max-h-64 overflow-auto text-xs">
          {events.map((e, i) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={`w-full border-b border-border/50 py-1.5 text-left ${i === index ? "bg-surface-2 font-semibold" : ""}`}
              >
                <span className="font-mono text-primary">{e.type}</span>
                <span className="ml-2 text-muted">{e.message}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
