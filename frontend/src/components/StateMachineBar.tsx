import { memo } from "react";

export const PHASES = [
  "BASELINE", "LOCALIZE", "PROSECUTOR", "DEFENDER",
  "EXECUTE", "TRACE", "JUDGE", "VERIFIED",
];

/** Visible deterministic state machine driven by real session status. */
export const StateMachineBar = memo(function StateMachineBar({
  status, currentRound,
}: {
  status: string;
  currentRound: number;
}) {
  const activeIndex = (() => {
    switch (status) {
      case "created": return 0;
      case "running": return Math.min(6, 1 + (currentRound % 6));
      case "verified": return 7;
      case "human_review":
      case "cancelled":
      case "terminated": return 7;
      default: return 0;
    }
  })();
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px]" aria-label="Debugging state machine">
      {PHASES.map((p, i) => (
        <li key={p} className="flex items-center gap-1">
          <span
            className={`rounded border px-2 py-1 font-mono ${
              i === activeIndex
                ? "border-primary bg-primary text-white"
                : i < activeIndex
                  ? "border-judge/50 bg-judge/10 text-judge"
                  : "border-border bg-surface text-muted"
            }`}
            aria-current={i === activeIndex ? "step" : undefined}
          >
            {p}
          </span>
          {i < PHASES.length - 1 ? <span aria-hidden className="text-muted">↓</span> : null}
        </li>
      ))}
    </ol>
  );
});
