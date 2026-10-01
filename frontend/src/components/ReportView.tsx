import { useMemo } from "react";
import type { SessionDetail } from "../types";
import { StatusBadge } from "./StatusBadge";

export function buildReportMarkdown(session: SessionDetail): string {
  const lines: string[] = [];
  lines.push(`# Swarm Debugger report — ${session.project_name}`);
  lines.push("");
  lines.push(`- Session: ${session.id}`);
  lines.push(`- Status: ${session.status}${session.terminated_reason ? ` (${session.terminated_reason})` : ""}`);
  lines.push(`- Language: ${session.language} · test command: \`${session.test_command}\``);
  lines.push(`- Rounds: ${session.current_round}/${session.max_rounds} · created ${session.created_at}`);
  lines.push(`- Demo mode: ${session.demo_mode ? "yes (deterministic demo provider)" : "no"}`);
  if (session.description) {
    lines.push("", "## Original bug", "", session.description);
  }
  const baseline = session.executions.find((e) => e.kind === "baseline");
  if (baseline) {
    lines.push(
      "",
      "## Baseline result",
      "",
      `- status: ${baseline.status} · exit code: ${baseline.exit_code ?? "?"}`,
      `- tests: ${baseline.tests_passed ?? 0}/${baseline.tests_total ?? 0} passed, ${baseline.tests_failed ?? 0} failed`,
      `- duration: ${baseline.duration_ms}ms · backend: ${baseline.sandbox_backend}`,
      "",
      "```",
      (baseline.stdout || "(no stdout)").slice(0, 4000),
      (baseline.stderr || "").slice(0, 4000),
      "```",
    );
  }
  for (const round of session.rounds) {
    lines.push("", `## Round ${round.number} (${round.status})`);
    if (round.summary) lines.push("", round.summary);
    for (const candidate of round.candidates) {
      const decision = round.decisions.find((d) => d.candidate_id === candidate.id);
      lines.push(
        "",
        `### Candidate ${candidate.agent} — ${candidate.status}`,
        "",
        `- root cause: ${candidate.root_cause || candidate.hypothesis || "n/a"}`,
        `- patch: ${candidate.patch_summary}`,
        `- files: ${candidate.files_changed.join(", ") || "none"}`,
        decision ? `- judge verdict: ${decision.verdict} — ${decision.reason}` : "- judge verdict: pending",
        decision ? `- evidence: ${decision.evidence_summary}` : "",
      );
    }
  }
  const verified = session.rounds
    .flatMap((r) => r.candidates)
    .find((c) => c.status === "VERIFIED");
  lines.push(
    "",
    "## Final result",
    "",
    verified
      ? `Verified fix by ${verified.agent}: ${verified.patch_summary} (files: ${verified.files_changed.join(", ")})`
      : "No verified fix. Rejected candidates are retained above as evidence for the next round.",
    "",
    "_Runtime/test output is the source of truth. LLM confidence was never treated as proof._",
  );
  return lines.filter((l) => l !== "").join("\n");
}

export function ReportView({ session }: { session: SessionDetail }) {
  const markdown = useMemo(() => buildReportMarkdown(session), [session]);

  function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const verified = session.rounds.flatMap((r) => r.candidates).find((c) => c.status === "VERIFIED");

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Debug report</h2>
            <StatusBadge status={session.status} />
            {verified ? (
              <span className="font-mono text-[11px] text-judge">
                VERIFIED BY {verified.agent.toUpperCase()}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              type="button"
              onClick={() => download(`swarm-report-${session.id}.md`, markdown, "text/markdown")}
            >
              Export Markdown
            </button>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
              type="button"
              onClick={() =>
                download(`swarm-report-${session.id}.json`, JSON.stringify(session, null, 2), "application/json")
              }
            >
              Export JSON
            </button>
          </div>
        </div>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted">Rounds</dt>
            <dd className="tabular-nums">
              {session.current_round}/{session.max_rounds}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Candidates</dt>
            <dd className="tabular-nums">{session.rounds.flatMap((r) => r.candidates).length}</dd>
          </div>
          <div>
            <dt className="text-muted">Executions</dt>
            <dd className="tabular-nums">{session.executions.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Termination</dt>
            <dd>{session.terminated_reason ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold">Original bug</h3>
        <p className="text-sm text-muted">{session.description || "No description provided."}</p>
        <h3 className="mb-2 mt-4 text-sm font-semibold">All candidates</h3>
        <ul className="flex flex-col gap-2">
          {session.rounds.flatMap((round) =>
            round.candidates.map((candidate) => {
              const decision = round.decisions.find((d) => d.candidate_id === candidate.id);
              return (
                <li
                  key={candidate.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs"
                >
                  <span className="font-mono text-muted">R{round.number}</span>
                  <span
                    className={
                      candidate.agent === "prosecutor" ? "font-semibold text-prosecutor" : "font-semibold text-defender"
                    }
                  >
                    {candidate.agent}
                  </span>
                  <span className="flex-1 truncate text-muted">{candidate.patch_summary}</span>
                  <StatusBadge status={decision?.verdict ?? candidate.status} />
                </li>
              );
            }),
          )}
          {session.rounds.length === 0 ? (
            <li className="text-xs text-muted">No rounds yet — baseline runs first.</li>
          ) : null}
        </ul>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-4 py-2 text-sm font-semibold">Report preview</header>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-5 text-muted">
          {markdown}
        </pre>
      </section>
    </div>
  );
}
