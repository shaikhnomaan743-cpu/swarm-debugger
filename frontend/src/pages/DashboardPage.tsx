import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import {
  deleteSession,
  getDashboardMetrics,
  getSession,
  getSystemStatus,
  listSessions,
} from "../services/api";
import type { DashboardMetrics, SessionDetail, SessionSummary, SystemStatus } from "../types";

function formatWhen(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type AgentRow = {
  sessionId: string;
  project: string;
  agent: "prosecutor" | "defender" | "judge";
  state: string;
  note: string;
};

function agentRows(details: SessionDetail[]): AgentRow[] {
  const rows: AgentRow[] = [];
  for (const session of details.slice(0, 5)) {
    const latest = session.rounds.at(-1);
    if (!latest) {
      rows.push({
        sessionId: session.id,
        project: session.project_name,
        agent: "prosecutor",
        state: session.status === "running" ? "THINKING" : "IDLE",
        note: "waiting for baseline",
      });
      continue;
    }
    for (const candidate of latest.candidates) {
      rows.push({
        sessionId: session.id,
        project: session.project_name,
        agent: candidate.agent as AgentRow["agent"],
        state:
          candidate.status === "VERIFIED"
            ? "VERIFIED"
            : candidate.status === "PASSED"
              ? "PASSED"
              : candidate.status === "RUNNING"
                ? "RUNNING"
                : candidate.status === "PROPOSED"
                  ? "THINKING"
                  : "FAILED",
        note: candidate.patch_summary || candidate.root_cause || "",
      });
    }
    const pending = latest.decisions.length < latest.candidates.length && latest.candidates.length > 0;
    rows.push({
      sessionId: session.id,
      project: session.project_name,
      agent: "judge",
      state: pending ? "RUNNING" : session.status === "verified" ? "VERIFIED" : "IDLE",
      note: pending
        ? `evaluating round ${latest.number}`
        : (latest.summary ?? `round ${latest.number} ${latest.status}`),
    });
  }
  return rows.slice(0, 8);
}

const AGENT_TONE: Record<string, string> = {
  prosecutor: "text-prosecutor",
  defender: "text-defender",
  judge: "text-judge",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [activity, setActivity] = useState<AgentRow[]>([]);
  const [latestExec, setLatestExec] = useState<string>("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const [nextMetrics, nextSessions, nextSystem] = await Promise.all([
      getDashboardMetrics(),
      listSessions(),
      getSystemStatus(),
    ]);
    setMetrics(nextMetrics);
    setSessions(nextSessions);
    setSystem(nextSystem);

    const recent = nextSessions.slice(0, 5);
    const details = (
      await Promise.allSettled(recent.map((s) => getSession(s.id)))
    ).flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    setActivity(agentRows(details));
    const executions = details.flatMap((d) => d.executions);
    const latest = executions.at(-1);
    setLatestExec(
      latest
        ? `${latest.kind} ${latest.status} · tests ${latest.tests_passed ?? 0}/${latest.tests_total ?? 0} · ${latest.duration_ms}ms · ${latest.sandbox_backend}`
        : "No executions yet.",
    );
  }

  useEffect(() => {
    let cancelled = false;
    refresh()
      .then(() => {
        if (!cancelled) setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      });
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function onDelete(session: SessionSummary) {
    if (!window.confirm(`Delete session “${session.project_name}”?`)) return;
    setBusyId(session.id);
    try {
      await deleteSession(session.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  const cards = [
    { label: "Active sessions", value: metrics?.active_sessions ?? "—" },
    { label: "Verified fixes", value: metrics?.verified_fixes ?? "—" },
    { label: "Failed candidates", value: metrics?.failed_candidates ?? "—" },
    { label: "Avg. rounds", value: metrics?.average_rounds ?? "—" },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold">Dashboard</h1>
          <p className="mt-2 text-sm text-muted">
            Runtime evidence is the source of truth. LLM confidence is never proof.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded-md border border-border px-4 py-2.5 text-sm text-muted hover:text-text"
            to="/app/history"
          >
            History
          </Link>
          <Link
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50"
            to="/app/new"
          >
            New Debug Session
          </Link>
        </div>
      </header>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-2 text-[28px] font-bold tabular-nums">{card.value}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Agent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No agent activity yet — create a session to see Prosecutor, Defender, and Judge states.
            </p>
          ) : (
            <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto">
              {activity.map((row, idx) => (
                <li
                  key={`${row.sessionId}-${row.agent}-${idx}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs"
                >
                  <span className={`w-24 shrink-0 font-semibold uppercase ${AGENT_TONE[row.agent]}`}>
                    {row.agent}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted" title={row.note}>
                    {row.project} — {row.note || row.state.toLowerCase()}
                  </span>
                  <StatusBadge status={row.state} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {system ? (
          <section className="rounded-lg border border-border bg-surface p-4 text-sm">
            <h2 className="text-base font-semibold">Sandbox</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-muted">Status</span>{" "}
                {system.sandbox_available ? "ready" : "unavailable"}
                {system.docker_available ? " · docker" : " · process fallback"}
              </p>
              <p>
                <span className="text-muted">Queue</span> {system.queue_depth}
              </p>
              <p>
                <span className="text-muted">CPU</span> {system.cpu_limit} ·{" "}
                <span className="text-muted">Memory</span> {system.memory_mb}MB
              </p>
              <p>
                <span className="text-muted">Timeout</span> {system.timeout_seconds}s
              </p>
              <p>
                <span className="text-muted">LLM</span> {system.llm_mode} / {system.llm_model}
              </p>
              <p>
                <span className="text-muted">Max rounds</span> {system.max_debug_rounds}
              </p>
            </div>
            <p className="mt-3 font-mono text-[11px] text-muted">Latest execution: {latestExec}</p>
            <p className="mt-1 text-xs text-muted">{system.isolation_note}</p>
          </section>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Recent sessions</h2>
          <Link className="text-xs text-primary hover:underline" to="/app/history">
            View all →
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No sessions yet. Start with the demo divide() fixture.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Round</th>
                  <th className="px-4 py-2 font-medium">Updated</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 8).map((session) => (
                  <tr key={session.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <button
                        className="text-left font-medium hover:text-primary"
                        type="button"
                        onClick={() => navigate(`/app/sessions/${session.id}`)}
                      >
                        {session.project_name}
                      </button>
                      {session.demo_mode ? (
                        <span className="ml-2 font-mono text-[11px] text-muted">DEMO</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {session.current_round}/{session.max_rounds}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatWhen(session.updated_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        className="text-xs text-danger hover:underline disabled:opacity-40"
                        type="button"
                        disabled={busyId === session.id || session.status === "running"}
                        onClick={() => void onDelete(session)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
