import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CodeEditor } from "../components/CodeEditor";
import { DiffViewer } from "../components/DiffViewer";
import { StateMachineBar } from "../components/StateMachineBar";
import { StatusBadge } from "../components/StatusBadge";
import { useSessionLive } from "../hooks/useSessionLive";
import { buildReportMarkdown } from "../components/ReportView";
import { cancelSession, startSession } from "../services/api";
import type { CandidateOut, ExecutionOut, SessionDetail } from "../types";

function executionFor(executions: ExecutionOut[], candidateId: string): ExecutionOut | undefined {
  return executions.filter((item) => item.candidate_id === candidateId).at(-1);
}

function originalContent(session: SessionDetail, path: string): string {
  return session.files.find((f) => f.path === path)?.content ?? "";
}

function AgentCard({
  candidate,
  execution,
  session,
}: {
  candidate: CandidateOut;
  execution?: ExecutionOut;
  session: SessionDetail;
}) {
  const [showPatch, setShowPatch] = useState(false);
  const isProsecutor = candidate.agent === "prosecutor";
  const accent = isProsecutor ? "border-prosecutor/50" : "border-defender/50";
  const label = isProsecutor ? "Prosecutor" : "Defender";
  const color = isProsecutor ? "text-prosecutor" : "text-defender";

  return (
    <article className={`rounded-lg border bg-surface-2 p-4 ${accent}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${color}`}>{label}</h3>
        <StatusBadge status={candidate.status} />
      </div>
      <p className="mt-3 text-sm">{candidate.root_cause || candidate.hypothesis || "No diagnosis yet."}</p>
      {candidate.hypothesis && candidate.root_cause ? (
        <p className="mt-1 text-xs text-muted">Hypothesis: {candidate.hypothesis}</p>
      ) : null}
      <p className="mt-2 text-xs text-muted">{candidate.patch_summary}</p>
      {candidate.objections ? (
        <p className="mt-2 border-l-2 border-defender/40 pl-2 text-xs text-muted">{candidate.objections}</p>
      ) : null}
      {candidate.falsification_tests ? (
        <p className="mt-2 text-xs text-muted">Falsification: {candidate.falsification_tests}</p>
      ) : null}
      {candidate.demo_mode ? (
        <p className="mt-2 font-mono text-[10px] text-muted">DEMO MODE — reasoning is simulated</p>
      ) : null}
      {execution ? (
        <p className="mt-3 font-mono text-[11px] text-muted">
          Runtime {execution.status} · tests {execution.tests_passed ?? 0}/{execution.tests_total ?? 0} ·{" "}
          {execution.duration_ms}ms · {execution.sandbox_backend}
        </p>
      ) : null}
      <button
        className="mt-3 text-xs text-primary hover:underline"
        type="button"
        onClick={() => setShowPatch((v) => !v)}
      >
        {showPatch ? "Hide patch ▾" : "View patch ▸"}
      </button>
      {showPatch ? (
        <div className="mt-2 flex flex-col gap-2">
          {candidate.files.map((file) => (
            <DiffViewer
              key={file.path}
              path={file.path}
              before={originalContent(session, file.path)}
              after={file.content}
            />
          ))}
          {candidate.files.length === 0 ? (
            <p className="text-xs text-muted">No files changed.</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function SessionPage() {
  const { sessionId } = useParams();
  const { session, error, setError, refresh } = useSessionLive(sessionId);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedFile = useMemo(() => {
    if (!session) return null;
    return session.files.find((file) => file.path === selectedPath) ?? session.files[0] ?? null;
  }, [selectedPath, session]);

  const baseline = session?.executions.find((item) => item.kind === "baseline");
  const latestExecution =
    session?.executions.filter((item) => item.kind !== "baseline").at(-1) ?? baseline;

  async function onStart() {
    if (!session) return;
    setBusy(true);
    try {
      await startSession(session.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!session) return;
    setBusy(true);
    try {
      await cancelSession(session.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  function onExport() {
    if (!session) return;
    const blob = new Blob([buildReportMarkdown(session)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `swarm-report-${session.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!session && !error) {
    return <p className="px-6 py-10 text-sm text-muted">Loading session…</p>;
  }

  if (!session) {
    return (
      <main className="px-6 py-10">
        <Link className="text-xs text-muted hover:text-text" to="/app">
          ← Dashboard
        </Link>
        <p className="mt-4 text-sm text-danger">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="text-xs text-muted hover:text-text" to="/app">
            ← Dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{session.project_name}</h1>
            <StatusBadge status={session.status} />
            <span className="font-mono text-xs text-muted">
              Round {session.current_round}/{session.max_rounds}
            </span>
            {session.demo_mode ? (
              <span className="font-mono text-[11px] text-muted">DEMO</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{session.description}</p>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {session.test_command} · {session.language} · {session.entry_point}
          </p>
          <div className="mt-3">
            <StateMachineBar status={session.status} currentRound={session.current_round} />
          </div>
          <p className="mt-2 flex flex-wrap gap-3 text-xs">
            <Link className="text-primary hover:underline" to="/app/arena">Agent Arena →</Link>
            <Link className="text-primary hover:underline" to="/app/evidence">Evidence →</Link>
            <Link className="text-primary hover:underline" to="/app/trace">Trace →</Link>
            <Link className="text-primary hover:underline" to="/app/causal">Causal graph →</Link>
            <Link className="text-primary hover:underline" to="/app/replay">Replay →</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
            to={`/app/sessions/${session.id}/report`}
          >
            Report
          </Link>
          <button
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
            type="button"
            onClick={onExport}
          >
            Export
          </button>
          {session.status === "created" ? (
            <button
              className="rounded-md bg-primary px-3 py-2 text-sm text-white disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={() => void onStart()}
            >
              Start
            </button>
          ) : null}
          {session.status === "running" ? (
            <button
              className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={() => void onCancel()}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {session.last_error ? <p className="text-sm text-danger">{session.last_error}</p> : null}

      {baseline ? (
        <section
          className={`rounded-lg border p-3 text-xs ${
            baseline.status === "PASSED"
              ? "border-judge/40 bg-judge/5"
              : "border-danger/40 bg-danger/5"
          }`}
        >
          <span className="font-semibold">Baseline — </span>
          <StatusBadge status={baseline.status} />
          <span className="ml-2 font-mono text-muted">
            exit {baseline.exit_code ?? "?"} · tests {baseline.tests_passed ?? 0}/{baseline.tests_total ?? 0} ·{" "}
            {baseline.duration_ms}ms · {baseline.sandbox_backend}
          </span>
          <span className="ml-2 text-muted">
            {baseline.status === "PASSED"
              ? "Bug not reproduced — human review required."
              : "Bug reproduced. Agents debate from this evidence."}
          </span>
        </section>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
          Baseline has not run yet — start the session to execute the original code first.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <section className="min-h-[320px] overflow-hidden rounded-lg border border-border bg-surface">
          <header className="border-b border-border px-3 py-2 text-sm font-semibold">Source</header>
          <ul className="flex flex-wrap gap-1 border-b border-border px-3 py-2 text-xs">
            {session.files.map((file) => (
              <li key={file.id}>
                <button
                  className={`rounded px-2 py-1 font-mono hover:bg-surface-2 ${
                    selectedFile?.id === file.id ? "bg-surface-2 text-text" : "text-muted"
                  }`}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                >
                  {file.path}
                  {file.protected ? <span className="ml-1 text-[10px]">protected</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="p-3">
            <CodeEditor
              value={selectedFile?.content ?? "No files"}
              language={session.language === "python" ? "python" : "typescript"}
              readOnly
              height={380}
              label="Original source file"
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-3">
          <header className="mb-3 text-sm font-semibold">
            Agent debate — what the agents think
          </header>
          {session.rounds.length ? (
            <div className="flex max-h-[560px] flex-col gap-4 overflow-auto pr-1">
              {session.rounds.map((round) => (
                <div key={round.id} className="flex flex-col gap-3">
                  <p className="font-mono text-[11px] text-muted">
                    Round {round.number} · {round.status}
                    {round.summary ? ` — ${round.summary}` : ""}
                  </p>
                  {round.candidates.map((candidate) => (
                    <AgentCard
                      key={candidate.id}
                      candidate={candidate}
                      execution={executionFor(session.executions, candidate.id)}
                      session={session}
                    />
                  ))}
                  {round.candidates.length === 0 ? (
                    <p className="text-sm text-muted">Waiting for Prosecutor / Defender…</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No round yet. Baseline runs first.</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-3">
          <header className="mb-3 text-sm font-semibold text-judge">
            Runtime Judge — what the code actually did
          </header>
          {session.rounds.some((r) => r.decisions.length) ? (
            <div className="flex max-h-[560px] flex-col gap-3 overflow-auto pr-1">
              {session.rounds.flatMap((round) =>
                round.decisions.map((decision) => {
                  const candidate = round.candidates.find((c) => c.id === decision.candidate_id);
                  return (
                    <article
                      key={decision.id}
                      className="rounded-lg border border-judge/30 bg-surface-2 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted">
                          R{round.number} · {candidate?.agent ?? "?"}
                        </span>
                        <StatusBadge status={decision.verdict} />
                      </div>
                      <p className="mt-2 text-sm">{decision.reason}</p>
                      <p className="mt-2 font-mono text-[11px] text-muted">{decision.evidence_summary}</p>
                      <p className="mt-1 text-xs text-muted">{decision.llm_explanation}</p>
                    </article>
                  );
                }),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Judge decides only after sandbox execution. Proposals are not verified yet.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-3 py-2 text-sm font-semibold">
          Runtime output / test evidence
        </header>
        <div className="grid gap-4 p-3 lg:grid-cols-2">
          <pre className="max-h-64 overflow-auto rounded-md bg-bg p-3 font-mono text-[12px] leading-5 text-muted">
            {latestExecution?.stdout || baseline?.stdout || "No stdout yet."}
            {"\n"}
            {latestExecution?.stderr || baseline?.stderr || ""}
          </pre>
          <ul className="max-h-64 overflow-auto text-xs">
            {session.events
              .slice()
              .reverse()
              .map((event) => (
                <li key={event.id} className="border-b border-border/60 py-2">
                  <span className="font-mono text-primary">{event.type}</span>
                  <span className="ml-2 text-muted">{event.message}</span>
                </li>
              ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
