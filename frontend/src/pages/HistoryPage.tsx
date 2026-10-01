import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { deleteSession, listSessions } from "../services/api";
import type { SessionSummary } from "../types";

const FILTERS = ["all", "running", "verified", "terminated", "human_review", "cancelled"] as const;

export function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((items) => {
        if (!cancelled) {
          setSessions(items);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load history");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filter === "running" && !(s.status === "running" || s.status === "created")) return false;
      if (filter !== "all" && filter !== "running" && s.status !== filter) return false;
      if (q && !s.project_name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sessions, filter, query]);

  async function onDelete(session: SessionSummary) {
    if (!window.confirm(`Delete session “${session.project_name}”? This keeps no local copy.`)) return;
    try {
      await deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="text-xs text-muted hover:text-text" to="/app">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-[28px] font-semibold">Session history</h1>
          <p className="mt-2 text-sm text-muted">
            Every round, candidate, and runtime result is preserved for review.
          </p>
        </div>
        <Link
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          to="/app/new"
        >
          New Debug Session
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide ${
              filter === f ? "border-primary bg-primary/15 text-text" : "border-border text-muted hover:text-text"
            }`}
          >
            {f.replaceAll("_", " ")}
          </button>
        ))}
        <input
          className="ml-auto min-w-52 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary sm:max-w-64 sm:flex-none"
          placeholder="Search project or session ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        {loading ? (
          <p className="px-4 py-8 text-sm text-muted">Loading history…</p>
        ) : visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted">No sessions match this filter.</p>
            <Link className="mt-3 inline-block text-sm text-primary hover:underline" to="/app/new">
              Create a debug session →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <button
                    className="block max-w-full truncate text-left font-medium hover:text-primary"
                    type="button"
                    onClick={() => navigate(`/app/sessions/${session.id}`)}
                  >
                    {session.project_name}
                  </button>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    {session.id.slice(0, 8)} · {session.language} · round {session.current_round}/{session.max_rounds}
                    {session.demo_mode ? " · DEMO" : ""}
                    {session.terminated_reason ? ` · ${session.terminated_reason.replaceAll("_", " ")}` : ""}
                  </p>
                </div>
                <StatusBadge status={session.status} />
                <Link
                  className="text-xs text-muted hover:text-text"
                  to={`/app/sessions/${session.id}/report`}
                >
                  Report
                </Link>
                <Link className="text-xs text-primary hover:underline" to={`/app/sessions/${session.id}`}>
                  Open →
                </Link>
                <button
                  className="text-xs text-danger hover:underline disabled:opacity-40"
                  type="button"
                  disabled={session.status === "running"}
                  onClick={() => void onDelete(session)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
