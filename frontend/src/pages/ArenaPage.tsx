import { Suspense, lazy, useEffect, useState } from "react";
import { getSession } from "../services/api";
import { getEvidence } from "../services/extended";
import type { SessionDetail } from "../types";
import type { EvidenceItem } from "../types/extended";
import { SessionPicker, useSessionOptions } from "./_shared";
import { HypothesisBattle3D } from "../components/three/HypothesisBattle3D";

const AgentArenaLive = lazy(() =>
  import("../components/three/AgentArenaLive").then((m) => ({ default: m.AgentArenaLive })),
);

function phaseFor(session: SessionDetail | null): "IDLE" | "ANALYZING" | "DEBATING" | "EXECUTING" | "TRACE" | "VERIFIED" | "REJECTED" | "NEXT_ROUND" {
  if (!session) return "IDLE";
  if (session.status === "verified") return "VERIFIED";
  if (session.status === "running") {
    const last = session.rounds.at(-1);
    if (!last) return "ANALYZING";
    if (last.status === "prosecutor") return "ANALYZING";
    if (last.status === "defender") return "DEBATING";
    if (last.status === "judging") return "EXECUTING";
    return "TRACE";
  }
  if (session.status === "terminated") return "REJECTED";
  return "IDLE";
}

export function ArenaPage() {
  const { sessions, selected, setSelected } = useSessionOptions();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  useEffect(() => {
    if (!selected) return;
    getSession(selected).then(setSession).catch(() => undefined);
    getEvidence(selected).then(setEvidence).catch(() => undefined);
  }, [selected]);

  const latest = session?.rounds.at(-1);
  const [a, b] = latest?.candidates ?? [];
  const execFor = (id?: string) => session?.executions.filter((e) => e.candidate_id === id).at(-1);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agent Arena</h1>
          <p className="text-sm text-muted">AI proposes. AI challenges. Code executes. Evidence decides.</p>
        </div>
        <SessionPicker sessions={sessions} selected={selected} onChange={setSelected} />
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <Suspense fallback={<p className="text-sm text-muted">Loading 3D arena…</p>}>
          <AgentArenaLive phase={phaseFor(session)} round={session?.current_round ?? 0} />
        </Suspense>
      </section>
      {latest ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Hypothesis battle — round {latest.number}</h2>
          <HypothesisBattle3D
            a={a} b={b}
            execA={a ? execFor(a.id) : undefined}
            execB={b ? execFor(b.id) : undefined}
            falsA={a ? evidence.find((e) => e.candidate_id === a.id && e.type === "FALSIFICATION_RESULT")?.content : undefined}
            falsB={b ? evidence.find((e) => e.candidate_id === b.id && e.type === "FALSIFICATION_RESULT")?.content : undefined}
          />
        </section>
      ) : (
        <p className="text-sm text-muted">Select a session with at least one round to see the battle.</p>
      )}
    </main>
  );
}
